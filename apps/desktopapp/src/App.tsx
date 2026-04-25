import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  acceptedCandidates,
  analysisCoverageTone,
  buildProfileMatchingSummary,
  buildProjectSummary,
  summarizeSessionQuality,
  defaultReviewQueueMode,
  deriveSessionReviewState,
  filterCandidates,
  filterCandidatesByPresentationMode,
  filterCandidatesByReviewMode,
  findNextPendingSessionSummary,
  hasStrongCandidateProfileMatch,
  isCandidatePending,
  reviewedCandidateCount,
  type ReviewQueueMode,
} from "@highlightsmith/domain";
import {
  toJsonCandidateExport,
  toTimestampExport,
} from "@highlightsmith/export";
import {
  isSupportedInput,
  supportedInputExtensions,
} from "@highlightsmith/media";
import { defaultProfileId } from "@highlightsmith/profiles";
import {
  addExampleClipRequestSchema,
  analyzeProjectRequestSchema,
  cancelMediaAlignmentJobRequestSchema,
  cancelMediaIndexJobRequestSchema,
  clipProfileSchema,
  createMediaAlignmentJobRequestSchema,
  createMediaEditPairRequestSchema,
  createMediaIndexJobRequestSchema,
  createMediaLibraryAssetRequestSchema,
  createClipProfileRequestSchema,
  exampleClipSchema,
  mediaAlignmentJobSchema,
  mediaAlignmentMatchSchema,
  mediaEditPairSchema,
  mediaIndexJobSchema,
  mediaLibraryAssetSchema,
  projectSessionSchema,
  projectSessionSummarySchema,
  replaceMediaThumbnailOutputsRequestSchema,
  type AddExampleClipRequest,
  type AnalyzeProjectRequest,
  type CancelMediaAlignmentJobRequest,
  type CancelMediaIndexJobRequest,
  type ClipProfile,
  type ConfidenceBand,
  type CreateMediaAlignmentJobRequest,
  type CreateMediaEditPairRequest,
  type CreateMediaIndexJobRequest,
  type CreateMediaLibraryAssetRequest,
  type CreateClipProfileRequest,
  type ExampleClip,
  type MediaAlignmentJob,
  type MediaAlignmentMatch,
  type MediaEditPair,
  type MediaIndexJob,
  type MediaLibraryAsset,
  type ProfilePresentationMode,
  type ProjectSession,
  type ProjectSessionSummary,
  type ReplaceMediaThumbnailOutputsRequest,
} from "@highlightsmith/shared-types";
import { sqliteSchemaVersion, sqliteTables } from "@highlightsmith/storage";
import { LayoutShell, TranscriptSnippetBlock } from "@highlightsmith/ui";
import { CandidateDetail } from "./components/CandidateDetail";
import { CandidateQueue } from "./components/CandidateQueue";
import { SessionOverview } from "./components/SessionOverview";
import { CandidateTimeline } from "./components/CandidateTimeline";
import { ProfileWorkspace } from "./components/ProfileWorkspace";
import { ShellHeader } from "./components/ShellHeader";
import { useReviewState } from "./hooks/useReviewState";
import {
  loadSessionResumeState,
  resolveSessionResumeState,
  saveSessionResumeState,
} from "./lib/resumeState";
import {
  fetchWithLocalApiMessage,
  localApiTimeouts,
} from "./lib/localApi";

type FilterValue = ConfidenceBand | "ALL";
type DesktopPage =
  | "projects"
  | "new-analysis"
  | "candidate-review"
  | "candidate-detail"
  | "profiles"
  | "settings";
type AnalysisReadiness = {
  canAnalyze: boolean;
  statusLabel: string;
  headline: string;
  detail: string;
  tone: "ready" | "blocked";
};
type ThemeMode = "dark" | "light";

const lastSessionIdStorageKey = "highlightsmith.desktop.last-session-id";
const themeModeStorageKey = "highlightsmith.desktop.theme-mode";
const desktopPages: Array<{ id: DesktopPage; label: string }> = [
  { id: "projects", label: "Projects" },
  { id: "new-analysis", label: "New Analysis" },
  { id: "candidate-review", label: "Candidate Review" },
  { id: "candidate-detail", label: "Candidate Detail" },
  { id: "profiles", label: "Profiles" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [activePage, setActivePage] = useState<DesktopPage>("new-analysis");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    resolveInitialThemeMode(),
  );
  const [projectSession, setProjectSession] = useState<ProjectSession | null>(
    null,
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [searchValue, setSearchValue] = useState("");
  const [bandFilter, setBandFilter] = useState<FilterValue>("ALL");
  const [reviewQueueMode, setReviewQueueMode] =
    useState<ReviewQueueMode>("ALL");
  const [presentationMode, setPresentationMode] =
    useState<ProfilePresentationMode>("ALL_CANDIDATES");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [selectedMediaPath, setSelectedMediaPath] = useState("");
  const [analysisProfileId, setAnalysisProfileId] = useState(defaultProfileId);
  const [analysisTitle, setAnalysisTitle] = useState("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [projectSummaries, setProjectSummaries] = useState<
    ProjectSessionSummary[]
  >([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ClipProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] =
    useState<string>(defaultProfileId);
  const [selectedProfileExamples, setSelectedProfileExamples] = useState<
    ExampleClip[]
  >([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isLoadingProfileExamples, setIsLoadingProfileExamples] =
    useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isAddingProfileExample, setIsAddingProfileExample] = useState(false);
  const [mediaLibraryAssets, setMediaLibraryAssets] = useState<
    MediaLibraryAsset[]
  >([]);
  const [mediaEditPairs, setMediaEditPairs] = useState<MediaEditPair[]>([]);
  const [mediaIndexJobs, setMediaIndexJobs] = useState<MediaIndexJob[]>([]);
  const [mediaAlignmentJobs, setMediaAlignmentJobs] = useState<
    MediaAlignmentJob[]
  >([]);
  const [mediaAlignmentMatches, setMediaAlignmentMatches] = useState<
    MediaAlignmentMatch[]
  >([]);
  const [isLoadingMediaLibraryAssets, setIsLoadingMediaLibraryAssets] =
    useState(false);
  const [isLoadingMediaEditPairs, setIsLoadingMediaEditPairs] = useState(false);
  const [isLoadingMediaIndexJobs, setIsLoadingMediaIndexJobs] = useState(false);
  const [isLoadingMediaAlignmentJobs, setIsLoadingMediaAlignmentJobs] =
    useState(false);
  const [isCreatingMediaLibraryAsset, setIsCreatingMediaLibraryAsset] =
    useState(false);
  const [isCreatingMediaEditPair, setIsCreatingMediaEditPair] = useState(false);
  const [isCreatingMediaIndexJob, setIsCreatingMediaIndexJob] = useState(false);
  const [isCreatingMediaAlignmentJob, setIsCreatingMediaAlignmentJob] =
    useState(false);
  const [cancellingMediaIndexJobIds, setCancellingMediaIndexJobIds] = useState<
    Record<string, boolean>
  >({});
  const [cancellingMediaAlignmentJobIds, setCancellingMediaAlignmentJobIds] =
    useState<Record<string, boolean>>({});
  const [savingThumbnailOutputAssetIds, setSavingThumbnailOutputAssetIds] =
    useState<Record<string, boolean>>({});
  const [profileLibraryError, setProfileLibraryError] = useState<string | null>(
    null,
  );

  const deferredSearchValue = useDeferredValue(searchValue);
  const apiBaseUrl =
    import.meta.env.VITE_HIGHLIGHTSMITH_API_BASE_URL ?? "http://127.0.0.1:4010";
  const sessionCandidates = projectSession?.candidates ?? [];
  const normalizedSelectedMediaPath = selectedMediaPath.trim();
  const availableProfiles = profiles;
  const hasPersistedProfiles = availableProfiles.length > 0;
  const selectedDraftProfile = resolveProfile(
    availableProfiles,
    analysisProfileId,
  );
  const currentProfile = resolveProfile(
    availableProfiles,
    projectSession?.profileId ?? analysisProfileId,
  );
  const selectedProfile = resolveProfile(availableProfiles, selectedProfileId);
  const profileMatchingSummary = buildProfileMatchingSummary(currentProfile);
  const analysisLaunchState = buildAnalysisLaunchState(
    normalizedSelectedMediaPath,
    {
      hasPersistedProfiles,
      isLoadingProfiles,
    },
  );
  const analysisSourceName = normalizedSelectedMediaPath
    ? extractSourceName(normalizedSelectedMediaPath)
    : null;
  const analysisTitlePreview = analysisTitle.trim()
    ? analysisTitle.trim()
    : normalizedSelectedMediaPath
      ? buildSuggestedSessionTitle(normalizedSelectedMediaPath)
      : "Use the source file name";
  const {
    decisionsByCandidateId,
    upsertDecision,
    reviewError,
    isSavingReview,
    clearError,
  } = useReviewState({
    apiBaseUrl,
    projectSession,
    onProjectSessionChange: (nextSession, context) => {
      const shouldAutoAdvance =
        context.action === "ACCEPT" || context.action === "REJECT";
      const preferredCandidateId = shouldAutoAdvance
        ? (findNextPendingCandidateId(nextSession, context.candidateId) ??
          findFirstPendingCandidateId(nextSession) ??
          context.candidateId)
        : context.candidateId;

      applyProjectSession(nextSession, {
        preferredCandidateId,
        preserveSelection: !shouldAutoAdvance,
        preserveFilters: true,
        rememberRealSession: true,
      });
      setProjectSummaries((current) =>
        upsertProjectSummary(current, buildProjectSummary(nextSession)),
      );
    },
  });

  const searchFilteredCandidates = useMemo(() => {
    return filterCandidates(
      sessionCandidates,
      deferredSearchValue,
      bandFilter,
      decisionsByCandidateId,
    );
  }, [
    bandFilter,
    decisionsByCandidateId,
    deferredSearchValue,
    labelDrafts,
    sessionCandidates,
  ]);
  const presentationFilteredCandidates = useMemo(() => {
    return filterCandidatesByPresentationMode(
      searchFilteredCandidates,
      currentProfile,
      presentationMode,
    );
  }, [currentProfile, presentationMode, searchFilteredCandidates]);
  const queueCandidates = useMemo(() => {
    if (!projectSession) {
      return presentationFilteredCandidates;
    }

    return filterCandidatesByReviewMode(
      presentationFilteredCandidates,
      projectSession,
      reviewQueueMode,
    );
  }, [presentationFilteredCandidates, projectSession, reviewQueueMode]);
  const hasAssessedStrongMatches = useMemo(() => {
    return searchFilteredCandidates.some((candidate) =>
      hasStrongCandidateProfileMatch(candidate, currentProfile),
    );
  }, [currentProfile, searchFilteredCandidates]);
  const isStrongMatchFallback =
    presentationMode === "STRONG_MATCHES" && !hasAssessedStrongMatches;

  const selectedCandidate =
    queueCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    presentationFilteredCandidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    ) ??
    sessionCandidates.find(
      (candidate) => candidate.id === selectedCandidateId,
    ) ??
    queueCandidates[0] ??
    (reviewQueueMode === "ALL" ? presentationFilteredCandidates[0] : null) ??
    null;
  const selectedCandidateIndex = selectedCandidate
    ? sessionCandidates.findIndex(
        (candidate) => candidate.id === selectedCandidate.id,
      )
    : -1;

  const selectedDecision = selectedCandidate
    ? decisionsByCandidateId[selectedCandidate.id]
    : undefined;
  const selectedCandidateVisibleInQueue = selectedCandidate
    ? queueCandidates.some((candidate) => candidate.id === selectedCandidate.id)
    : true;

  const acceptedCount = acceptedCandidates(
    sessionCandidates,
    decisionsByCandidateId,
  ).length;
  const rejectedCount = sessionCandidates.filter(
    (candidate) => decisionsByCandidateId[candidate.id]?.action === "REJECT",
  ).length;
  const reviewedCount = acceptedCount + rejectedCount;
  const pendingReviewCount = Math.max(
    sessionCandidates.length - reviewedCount,
    0,
  );
  const activeSessionSummary = projectSession
    ? buildProjectSummary(projectSession)
    : null;
  const activeSessionReviewState = activeSessionSummary
    ? deriveSessionReviewState(activeSessionSummary)
    : null;
  const activeSessionReviewStateLabel = activeSessionReviewState
    ? formatSessionReviewState(activeSessionReviewState)
    : null;
  const pendingSessionCount = projectSummaries.filter(
    (summary) => summary.pendingCount > 0,
  ).length;
  const nextPendingSession =
    findNextPendingSessionSummary(projectSummaries, {
      excludeSessionIds: projectSession ? [projectSession.id] : [],
    }) ?? findNextPendingSessionSummary(projectSummaries);

  const timestampPreview = projectSession
    ? toTimestampExport(
        sessionCandidates,
        Object.values(decisionsByCandidateId),
      )
    : "";

  const jsonPreview = projectSession
    ? toJsonCandidateExport(
        projectSession.mediaSource,
        sessionCandidates,
        Object.values(decisionsByCandidateId),
      )
    : "";

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    window.localStorage.setItem(themeModeStorageKey, themeMode);
  }, [themeMode]);

  useEffect(() => {
    let isCancelled = false;

    async function loadProjectSummaries() {
      setIsLoadingProjects(true);
      try {
        const summaries = await fetchProjectSummaries(apiBaseUrl);
        if (isCancelled) {
          return;
        }

        setProjectSummaries(summaries);
        setProjectsError(null);
        setActivePage((current) => {
          if (current !== "new-analysis") {
            return current;
          }

          if (window.localStorage.getItem(lastSessionIdStorageKey)) {
            return current;
          }

          return summaries.length > 0 ? "projects" : current;
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setProjectsError(
          error instanceof Error
            ? `Unable to load persisted sessions: ${error.message}`
            : "Unable to load persisted sessions",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadProjectSummaries();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let isCancelled = false;

    async function loadProfiles() {
      setIsLoadingProfiles(true);
      try {
        const nextProfiles = await fetchProfiles(apiBaseUrl);
        if (isCancelled) {
          return;
        }

        setProfiles(nextProfiles);
        setProfileLibraryError(null);
        setSelectedProfileId((current) =>
          nextProfiles.some((profile) => profile.id === current)
            ? current
            : (nextProfiles[0]?.id ?? defaultProfileId),
        );
        setAnalysisProfileId((current) =>
          nextProfiles.some((profile) => profile.id === current)
            ? current
            : (nextProfiles[0]?.id ?? defaultProfileId),
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setProfileLibraryError(
          error instanceof Error
            ? `Unable to load clip profiles: ${error.message}`
            : "Unable to load clip profiles",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingProfiles(false);
        }
      }
    }

    void loadProfiles();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMediaLibraryAssets() {
      setIsLoadingMediaLibraryAssets(true);
      try {
        const nextAssets = await fetchMediaLibraryAssets(apiBaseUrl);
        if (isCancelled) {
          return;
        }

        setMediaLibraryAssets(nextAssets);
        setProfileLibraryError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setProfileLibraryError(
          error instanceof Error
            ? `Unable to load media library assets: ${error.message}`
            : "Unable to load media library assets",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingMediaLibraryAssets(false);
        }
      }
    }

    void loadMediaLibraryAssets();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMediaEditPairs() {
      setIsLoadingMediaEditPairs(true);
      try {
        const nextPairs = await fetchMediaEditPairs(apiBaseUrl);
        if (isCancelled) {
          return;
        }

        setMediaEditPairs(nextPairs);
        setProfileLibraryError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setProfileLibraryError(
          error instanceof Error
            ? `Unable to load VOD/edit pairs: ${error.message}`
            : "Unable to load VOD/edit pairs",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingMediaEditPairs(false);
        }
      }
    }

    void loadMediaEditPairs();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMediaIndexJobs() {
      setIsLoadingMediaIndexJobs(true);
      try {
        const nextJobs = await fetchMediaIndexJobs(apiBaseUrl);
        if (isCancelled) {
          return;
        }

        setMediaIndexJobs(nextJobs);
        setProfileLibraryError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setProfileLibraryError(
          error instanceof Error
            ? `Unable to load media index jobs: ${error.message}`
            : "Unable to load media index jobs",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingMediaIndexJobs(false);
        }
      }
    }

    void loadMediaIndexJobs();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    const hasActiveIndexJobs = mediaIndexJobs.some(
      (job) => job.status === "QUEUED" || job.status === "RUNNING",
    );
    if (!hasActiveIndexJobs) {
      return;
    }

    let isCancelled = false;
    const intervalId = window.setInterval(() => {
      async function refreshIndexState() {
        try {
          const [nextJobs, nextAssets, nextPairs] = await Promise.all([
            fetchMediaIndexJobs(apiBaseUrl),
            fetchMediaLibraryAssets(apiBaseUrl),
            fetchMediaEditPairs(apiBaseUrl),
          ]);
          if (isCancelled) {
            return;
          }

          setMediaIndexJobs(nextJobs);
          setMediaLibraryAssets(nextAssets);
          setMediaEditPairs(nextPairs);
        } catch {
          // Keep the current UI state; the explicit refresh/load effects surface errors.
        }
      }

      void refreshIndexState();
    }, 2000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [apiBaseUrl, mediaIndexJobs]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMediaAlignmentState() {
      setIsLoadingMediaAlignmentJobs(true);
      try {
        const [nextJobs, nextMatches] = await Promise.all([
          fetchMediaAlignmentJobs(apiBaseUrl),
          fetchMediaAlignmentMatches(apiBaseUrl),
        ]);
        if (isCancelled) {
          return;
        }

        setMediaAlignmentJobs(nextJobs);
        setMediaAlignmentMatches(nextMatches);
        setProfileLibraryError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setProfileLibraryError(
          error instanceof Error
            ? `Unable to load media alignment state: ${error.message}`
            : "Unable to load media alignment state",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingMediaAlignmentJobs(false);
        }
      }
    }

    void loadMediaAlignmentState();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    const hasActiveAlignmentJobs = mediaAlignmentJobs.some(
      (job) => job.status === "QUEUED" || job.status === "RUNNING",
    );
    if (!hasActiveAlignmentJobs) {
      return;
    }

    let isCancelled = false;
    const intervalId = window.setInterval(() => {
      async function refreshAlignmentState() {
        try {
          const [nextJobs, nextMatches, nextPairs] = await Promise.all([
            fetchMediaAlignmentJobs(apiBaseUrl),
            fetchMediaAlignmentMatches(apiBaseUrl),
            fetchMediaEditPairs(apiBaseUrl),
          ]);
          if (isCancelled) {
            return;
          }

          setMediaAlignmentJobs(nextJobs);
          setMediaAlignmentMatches(nextMatches);
          setMediaEditPairs(nextPairs);
        } catch {
          // Keep current state; explicit load effects surface persistent failures.
        }
      }

      void refreshAlignmentState();
    }, 2000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [apiBaseUrl, mediaAlignmentJobs]);

  useEffect(() => {
    if (!selectedProfileId) {
      setSelectedProfileExamples([]);
      return;
    }

    let isCancelled = false;

    async function loadExamples() {
      setIsLoadingProfileExamples(true);
      try {
        const examples = await fetchProfileExamples(
          apiBaseUrl,
          selectedProfileId,
        );
        if (isCancelled) {
          return;
        }

        setSelectedProfileExamples(examples);
        setProfiles((current) =>
          current.map((profile) =>
            profile.id === selectedProfileId
              ? { ...profile, exampleClips: examples }
              : profile,
          ),
        );
        setProfileLibraryError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setProfileLibraryError(
          error instanceof Error
            ? `Unable to load example clips: ${error.message}`
            : "Unable to load example clips",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingProfileExamples(false);
        }
      }
    }

    void loadExamples();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl, selectedProfileId]);

  useEffect(() => {
    if (!projectSession) {
      return;
    }

    const queueIndex = selectedCandidate
      ? queueCandidates.findIndex(
          (candidate) => candidate.id === selectedCandidate.id,
        )
      : -1;

    saveSessionResumeState(projectSession.id, {
      selectedCandidateId: selectedCandidate?.id ?? null,
      reviewQueueMode,
      queueIndex: queueIndex >= 0 ? queueIndex : null,
      updatedAt: new Date().toISOString(),
    });
  }, [projectSession, queueCandidates, reviewQueueMode, selectedCandidate?.id]);

  useEffect(() => {
    const lastSessionId = window.localStorage.getItem(lastSessionIdStorageKey);
    if (!lastSessionId) {
      return;
    }
    const sessionIdToRestore = lastSessionId;

    let isCancelled = false;

    async function restoreLastSession() {
      try {
        const nextSession = await fetchProjectSession(
          apiBaseUrl,
          sessionIdToRestore,
        );
        if (isCancelled) {
          return;
        }

        applyProjectSession(nextSession, {
          restoreResumeState: true,
          rememberRealSession: true,
        });
        setProjectSummaries((current) =>
          upsertProjectSummary(current, buildProjectSummary(nextSession)),
        );
        setAnalysisError(null);
        setActivePage("candidate-review");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setAnalysisError(
          error instanceof Error
            ? `Unable to restore the last local session: ${error.message}`
            : "Unable to restore the last local session",
        );
      }
    }

    void restoreLastSession();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl]);

  async function handlePickMedia() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selection = await open({
        directory: false,
        multiple: false,
        filters: [
          {
            name: "Media",
            extensions: supportedInputExtensions.map((extension) =>
              extension.slice(1),
            ),
          },
        ],
      });

      if (typeof selection === "string" && isSupportedInput(selection)) {
        setSelectedMediaPath(selection);
        setAnalysisError(null);
        if (!analysisTitle.trim()) {
          setAnalysisTitle(buildSuggestedSessionTitle(selection));
        }
        setActivePage("new-analysis");
        return;
      }

      if (typeof selection === "string") {
        setSelectedMediaPath(selection);
        setAnalysisError(
          `Unsupported media extension. Supported inputs: ${supportedInputExtensions.join(", ")}`,
        );
        setActivePage("new-analysis");
        return;
      }
    } catch {
      setAnalysisError(
        "Desktop file picking is available in the Tauri app. You can also paste a full local file path below.",
      );
    }
  }

  async function handleCreateProfile(input: CreateClipProfileRequest) {
    const request = createClipProfileRequestSchema.parse(input);
    setIsCreatingProfile(true);
    setProfileLibraryError(null);

    try {
      const createdProfile = await createProfile(apiBaseUrl, request);
      setProfiles((current) =>
        upsertProfile(current, {
          ...createdProfile,
          exampleClips: createdProfile.exampleClips ?? [],
        }),
      );
      setSelectedProfileId(createdProfile.id);
      setSelectedProfileExamples(createdProfile.exampleClips ?? []);
      setAnalysisProfileId(createdProfile.id);
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected profile creation failure while contacting the local API",
      );
      throw error;
    } finally {
      setIsCreatingProfile(false);
    }
  }

  async function handleAddProfileExample(
    profileId: string,
    input: AddExampleClipRequest,
  ) {
    const request = addExampleClipRequestSchema.parse(input);
    setIsAddingProfileExample(true);
    setProfileLibraryError(null);

    try {
      const createdExample = await createProfileExample(
        apiBaseUrl,
        profileId,
        request,
      );
      const nextExamples = [
        createdExample,
        ...selectedProfileExamples.filter(
          (example) => example.id !== createdExample.id,
        ),
      ];
      setSelectedProfileExamples(nextExamples);
      setProfiles((current) =>
        current.map((profile) =>
          profile.id === profileId
            ? {
                ...profile,
                exampleClips: nextExamples,
                updatedAt: createdExample.updatedAt,
              }
            : profile,
        ),
      );
      if (projectSession?.profileId === profileId) {
        const refreshedSession = await fetchProjectSession(
          apiBaseUrl,
          projectSession.id,
        );
        applyProjectSession(refreshedSession, {
          preferredCandidateId: selectedCandidateId,
          preserveSelection: true,
          preserveFilters: true,
          rememberRealSession: true,
        });
        setProjectSummaries((current) =>
          upsertProjectSummary(current, buildProjectSummary(refreshedSession)),
        );
      }
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected example clip save failure while contacting the local API",
      );
      throw error;
    } finally {
      setIsAddingProfileExample(false);
    }
  }

  async function handleCreateMediaLibraryAsset(
    input: CreateMediaLibraryAssetRequest,
  ) {
    const request = createMediaLibraryAssetRequestSchema.parse(input);
    setIsCreatingMediaLibraryAsset(true);
    setProfileLibraryError(null);

    try {
      const createdAsset = await createMediaLibraryAssetEntry(apiBaseUrl, request);
      setMediaLibraryAssets((current) =>
        upsertMediaLibraryAsset(current, createdAsset),
      );
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected media library save failure while contacting the local API",
      );
      throw error;
    } finally {
      setIsCreatingMediaLibraryAsset(false);
    }
  }

  async function handleCreateMediaEditPair(input: CreateMediaEditPairRequest) {
    const request = createMediaEditPairRequestSchema.parse(input);
    setIsCreatingMediaEditPair(true);
    setProfileLibraryError(null);

    try {
      const createdPair = await createMediaEditPairEntry(apiBaseUrl, request);
      setMediaEditPairs((current) => upsertMediaEditPair(current, createdPair));
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected VOD/edit pair save failure while contacting the local API",
      );
      throw error;
    } finally {
      setIsCreatingMediaEditPair(false);
    }
  }

  async function handleCreateMediaIndexJob(input: CreateMediaIndexJobRequest) {
    const request = createMediaIndexJobRequestSchema.parse(input);
    setIsCreatingMediaIndexJob(true);
    setProfileLibraryError(null);

    try {
      const createdJob = await createMediaIndexJobEntry(apiBaseUrl, request);
      setMediaIndexJobs((current) => upsertMediaIndexJob(current, createdJob));
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected media index job failure while contacting the local API",
      );
      throw error;
    } finally {
      setIsCreatingMediaIndexJob(false);
    }
  }

  async function handleReplaceMediaThumbnailOutputs(
    assetId: string,
    input: ReplaceMediaThumbnailOutputsRequest,
  ) {
    const request = replaceMediaThumbnailOutputsRequestSchema.parse(input);
    setSavingThumbnailOutputAssetIds((current) => ({
      ...current,
      [assetId]: true,
    }));
    setProfileLibraryError(null);

    try {
      const updatedAsset = await replaceMediaThumbnailOutputsEntry(
        apiBaseUrl,
        assetId,
        request,
      );
      setMediaLibraryAssets((current) =>
        upsertMediaLibraryAsset(current, updatedAsset),
      );
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected thumbnail output update failure while contacting the local API",
      );
      throw error;
    } finally {
      setSavingThumbnailOutputAssetIds((current) => {
        const { [assetId]: _removed, ...nextState } = current;
        return nextState;
      });
    }
  }

  async function handleCancelMediaIndexJob(input: CancelMediaIndexJobRequest) {
    const request = cancelMediaIndexJobRequestSchema.parse(input);
    setCancellingMediaIndexJobIds((current) => ({
      ...current,
      [request.jobId]: true,
    }));
    setProfileLibraryError(null);

    try {
      const cancelledJob = await cancelMediaIndexJobEntry(apiBaseUrl, request);
      setMediaIndexJobs((current) => upsertMediaIndexJob(current, cancelledJob));
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected media index cancellation failure while contacting the local API",
      );
      throw error;
    } finally {
      setCancellingMediaIndexJobIds((current) => {
        const { [request.jobId]: _removed, ...nextState } = current;
        return nextState;
      });
    }
  }

  async function handleCreateMediaAlignmentJob(
    input: CreateMediaAlignmentJobRequest,
  ) {
    const request = createMediaAlignmentJobRequestSchema.parse(input);
    setIsCreatingMediaAlignmentJob(true);
    setProfileLibraryError(null);

    try {
      const createdJob = await createMediaAlignmentJobEntry(apiBaseUrl, request);
      setMediaAlignmentJobs((current) =>
        upsertMediaAlignmentJob(current, createdJob),
      );
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected media alignment job failure while contacting the local API",
      );
      throw error;
    } finally {
      setIsCreatingMediaAlignmentJob(false);
    }
  }

  async function handleCancelMediaAlignmentJob(
    input: CancelMediaAlignmentJobRequest,
  ) {
    const request = cancelMediaAlignmentJobRequestSchema.parse(input);
    setCancellingMediaAlignmentJobIds((current) => ({
      ...current,
      [request.jobId]: true,
    }));
    setProfileLibraryError(null);

    try {
      const cancelledJob = await cancelMediaAlignmentJobEntry(apiBaseUrl, request);
      setMediaAlignmentJobs((current) =>
        upsertMediaAlignmentJob(current, cancelledJob),
      );
    } catch (error) {
      setProfileLibraryError(
        error instanceof Error
          ? error.message
          : "Unexpected media alignment cancellation failure while contacting the local API",
      );
      throw error;
    } finally {
      setCancellingMediaAlignmentJobIds((current) => {
        const { [request.jobId]: _removed, ...nextState } = current;
        return nextState;
      });
    }
  }

  function handleSearchChange(nextValue: string) {
    startTransition(() => {
      setSearchValue(nextValue);
    });
  }

  function handleReviewQueueModeChange(nextMode: ReviewQueueMode) {
    startTransition(() => {
      setReviewQueueMode(nextMode);
    });
  }

  function handleSelectCandidate(candidateId: string) {
    startTransition(() => {
      setSelectedCandidateId(candidateId);
    });
  }

  function handleLabelChange(nextValue: string) {
    if (!selectedCandidate) {
      return;
    }

    clearError();
    setLabelDrafts((current) => ({
      ...current,
      [selectedCandidate.id]: nextValue,
    }));
  }

  function handleSaveLabel() {
    if (!selectedCandidate) {
      return;
    }

    void upsertDecision(selectedCandidate, "RELABEL", {
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleAccept() {
    if (!selectedCandidate) {
      return;
    }

    void upsertDecision(selectedCandidate, "ACCEPT", {
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleReject() {
    if (!selectedCandidate) {
      return;
    }

    void upsertDecision(selectedCandidate, "REJECT", {
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleExpandSetup() {
    if (!selectedCandidate) {
      return;
    }

    const currentSegment =
      decisionsByCandidateId[selectedCandidate.id]?.adjustedSegment ??
      selectedCandidate.suggestedSegment;

    void upsertDecision(selectedCandidate, "RETIME", {
      adjustedSegment: {
        startSeconds: Math.max(0, currentSegment.startSeconds - 2),
        endSeconds: currentSegment.endSeconds,
      },
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function handleExpandResolution() {
    if (!selectedCandidate || !projectSession) {
      return;
    }

    const currentSegment =
      decisionsByCandidateId[selectedCandidate.id]?.adjustedSegment ??
      selectedCandidate.suggestedSegment;

    void upsertDecision(selectedCandidate, "RETIME", {
      adjustedSegment: {
        startSeconds: currentSegment.startSeconds,
        endSeconds: Math.min(
          projectSession.mediaSource.durationSeconds,
          currentSegment.endSeconds + 2,
        ),
      },
      label: labelDrafts[selectedCandidate.id],
    });
  }

  function applyProjectSession(
    nextSession: ProjectSession,
    options: {
      preferredCandidateId?: string | null;
      preserveSelection?: boolean;
      preserveFilters?: boolean;
      rememberRealSession?: boolean;
      restoreResumeState?: boolean;
    } = {},
  ) {
    const restoredResumeState = options.restoreResumeState
      ? resolveSessionResumeState(
          nextSession,
          loadSessionResumeState(nextSession.id),
        )
      : null;
    const nextDefaultReviewQueueMode =
      restoredResumeState?.reviewQueueMode ??
      defaultReviewQueueMode(nextSession);
    const preferredCandidateId =
      options.preferredCandidateId &&
      nextSession.candidates.some(
        (candidate) => candidate.id === options.preferredCandidateId,
      )
        ? options.preferredCandidateId
        : null;
    const restoredCandidateId =
      restoredResumeState?.selectedCandidateId &&
      nextSession.candidates.some(
        (candidate) => candidate.id === restoredResumeState.selectedCandidateId,
      )
        ? restoredResumeState.selectedCandidateId
        : null;
    const preservedSelectedCandidateId =
      options.preserveSelection &&
      selectedCandidateId &&
      nextSession.candidates.some(
        (candidate) => candidate.id === selectedCandidateId,
      )
        ? selectedCandidateId
        : null;
    const nextSelectedCandidateId =
      preferredCandidateId ??
      preservedSelectedCandidateId ??
      restoredCandidateId ??
      (nextDefaultReviewQueueMode === "ONLY_PENDING"
        ? findFirstPendingCandidateId(nextSession)
        : null) ??
      nextSession.candidates[0]?.id ??
      null;
    const nextReviewQueueMode = options.restoreResumeState
      ? nextDefaultReviewQueueMode
      : projectSession?.id === nextSession.id
        ? nextDefaultReviewQueueMode === "ALL" &&
          reviewQueueMode === "ONLY_PENDING"
          ? "ALL"
          : reviewQueueMode
        : nextDefaultReviewQueueMode;

    setProjectSession(nextSession);
    setReviewQueueMode(nextReviewQueueMode);
    setSelectedCandidateId(nextSelectedCandidateId);
    setLabelDrafts(buildLabelDrafts(nextSession));
    setSelectedMediaPath(nextSession.mediaSource.path);
    setAnalysisProfileId(nextSession.profileId);
    setSelectedProfileId(nextSession.profileId);
    setAnalysisTitle(nextSession.title);
    if (!options.preserveFilters) {
      setSearchValue("");
      setBandFilter("ALL");
      setPresentationMode("ALL_CANDIDATES");
    }
    if (options.rememberRealSession) {
      window.localStorage.setItem(lastSessionIdStorageKey, nextSession.id);
    }
  }

  async function handleAnalyze() {
    if (!analysisLaunchState.canAnalyze) {
      setAnalysisError(analysisLaunchState.detail);
      return;
    }

    const normalizedSourcePath = normalizedSelectedMediaPath;

    const request = analyzeProjectRequestSchema.parse({
      sourcePath: normalizedSourcePath,
      profileId: analysisProfileId,
      sessionTitle: analysisTitle.trim() || undefined,
    }) satisfies AnalyzeProjectRequest;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetchWithLocalApiMessage(
        `${apiBaseUrl}/api/projects/analyze`,
        apiBaseUrl,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
        },
        "Unable to start local analysis.",
        localApiTimeouts.analysis,
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
          }
        | ProjectSession
        | null;

      if (!response.ok) {
        throw new Error(
          payload && "message" in payload && payload.message
            ? payload.message
            : "Analysis request failed",
        );
      }

      const nextSession = projectSessionSchema.parse(payload);
      applyProjectSession(nextSession, {
        rememberRealSession: true,
      });
      setSelectedMediaPath(normalizedSourcePath);
      setProjectSummaries((current) =>
        upsertProjectSummary(current, buildProjectSummary(nextSession)),
      );
      setProjectsError(null);
      setActivePage("candidate-review");
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Unexpected analysis failure while contacting the local API",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleOpenProject(sessionId: string) {
    setProjectsError(null);

    try {
      const nextSession = await fetchProjectSession(apiBaseUrl, sessionId);
      applyProjectSession(nextSession, {
        restoreResumeState: true,
        rememberRealSession: true,
      });
      setProjectSummaries((current) =>
        upsertProjectSummary(current, buildProjectSummary(nextSession)),
      );
      setActivePage("candidate-review");
    } catch (error) {
      setProjectsError(
        error instanceof Error
          ? error.message
          : "Unexpected session load failure while contacting the local API",
      );
    }
  }

  function handleSelectNextPending() {
    if (!projectSession) {
      return;
    }

    const nextPendingCandidateId =
      findNextPendingCandidateId(projectSession, selectedCandidateId) ??
      findFirstPendingCandidateId(projectSession);

    if (!nextPendingCandidateId) {
      return;
    }

    setSelectedCandidateId(nextPendingCandidateId);
  }

  function handleSelectPreviousVisible() {
    const previousCandidateId = findAdjacentVisibleCandidateId(
      queueCandidates,
      selectedCandidateId,
      -1,
    );

    if (!previousCandidateId) {
      return;
    }

    setSelectedCandidateId(previousCandidateId);
  }

  function handleSelectNextVisible() {
    const nextCandidateId = findAdjacentVisibleCandidateId(
      queueCandidates,
      selectedCandidateId,
      1,
    );

    if (!nextCandidateId) {
      return;
    }

    setSelectedCandidateId(nextCandidateId);
  }

  function handleReturnToProjects() {
    setActivePage("projects");
  }

  async function handleOpenNextPendingSession() {
    if (!nextPendingSession) {
      setProjectsError(null);
      setActivePage("projects");
      return;
    }

    await handleOpenProject(nextPendingSession.sessionId);
  }

  function renderDesktopPage() {
    if (activePage === "projects") {
      return (
        <section className="desktop-placeholder-grid">
          {isLoadingProjects ? (
            <article className="utility-block">
              <span className="detail-label">Project sessions</span>
              <h2>Loading persisted backlog sessions...</h2>
            </article>
          ) : null}
          {projectsError ? (
            <article className="utility-block">
              <span className="detail-label">Project sessions</span>
              <p className="analysis-error">{projectsError}</p>
            </article>
          ) : null}
          {!isLoadingProjects &&
          !projectsError &&
          projectSummaries.length === 0 ? (
            <article className="utility-block">
              <span className="detail-label">Project sessions</span>
              <h2>No persisted sessions yet</h2>
              <p>
                Run a local analysis to create the first real backlog session in
                SQLite.
              </p>
            </article>
          ) : null}
          {!isLoadingProjects &&
          !projectsError &&
          projectSummaries.length > 0 ? (
            <article className="utility-block backlog-shortcut-card">
              <div className="panel-header">
                <div>
                  <span className="detail-label">Backlog throughput</span>
                  <h2>
                    {nextPendingSession
                      ? "Resume the next useful incomplete session"
                      : "Backlog review is currently clear"}
                  </h2>
                  <p>
                    {nextPendingSession
                      ? `${pendingSessionCount} sessions still have pending candidates.`
                      : "Every persisted session currently has decisions for all candidates."}
                  </p>
                </div>
                <span className="queue-count">
                  {pendingSessionCount} pending sessions
                </span>
              </div>
              <div className="action-row">
                {nextPendingSession ? (
                  <button
                    className="button-primary"
                    onClick={() => {
                      void handleOpenNextPendingSession();
                    }}
                    type="button"
                  >
                    Open next pending session
                  </button>
                ) : (
                  <button
                    className="button-secondary"
                    onClick={() => setActivePage("new-analysis")}
                    type="button"
                  >
                    Analyze another local VOD
                  </button>
                )}
              </div>
              <p className="project-summary-cta">
                {nextPendingSession
                  ? `${nextPendingSession.sessionTitle} • ${nextPendingSession.pendingCount} pending • updated ${formatSummaryTimestamp(nextPendingSession.updatedAt)}`
                  : "Use New Analysis to add the next backlog session."}
              </p>
            </article>
          ) : null}
          {projectSummaries.map((summary) => {
            const profile = resolveProfile(
              availableProfiles,
              summary.profileId,
            );
            const sessionReviewState = deriveSessionReviewState(summary);
            const isActiveSession = summary.sessionId === projectSession?.id;
            const isNextPendingSession =
              summary.sessionId === nextPendingSession?.sessionId;
            return (
              <button
                className={
                  isActiveSession
                    ? "project-summary-card utility-block active"
                    : "project-summary-card utility-block"
                }
                key={summary.sessionId}
                onClick={() => {
                  void handleOpenProject(summary.sessionId);
                }}
                type="button"
              >
                <div className="project-summary-top">
                  <span className="detail-label">Project session</span>
                  <div className="project-summary-badges">
                    <span
                      className={`session-state-pill ${sessionReviewState.toLowerCase().replace("_", "-")}`}
                    >
                      {formatSessionReviewState(sessionReviewState)}
                    </span>
                    {isNextPendingSession ? (
                      <span className="session-state-pill next-target">
                        Next up
                      </span>
                    ) : null}
                    {isActiveSession ? (
                      <span className="session-state-pill active-session">
                        Loaded
                      </span>
                    ) : null}
                  </div>
                </div>
                <h2>{summary.sessionTitle}</h2>
                <p>{summary.sourceName}</p>
                <p>{summary.sourcePath}</p>
                <div className="project-summary-progress">
                  <div className="project-summary-meter">
                    <div
                      className="project-summary-fill"
                      style={{
                        width: `${formatSessionCompletion(summary)}%`,
                      }}
                    />
                  </div>
                  <p>
                    {reviewedCandidateCount(summary)} of{" "}
                    {summary.candidateCount} reviewed
                  </p>
                </div>
                <p>
                  {summary.candidateCount} candidates • {summary.acceptedCount}{" "}
                  accepted • {summary.rejectedCount} rejected •{" "}
                  {summary.pendingCount} pending
                </p>
                <p
                  className={`project-summary-coverage ${analysisCoverageTone(summary.analysisCoverage)}`}
                >
                  {buildProjectCoverageCopy(summary)}
                </p>
                <p>
                  Profile {profile.name} • updated{" "}
                  {formatSummaryTimestamp(summary.updatedAt)}
                </p>
                <p className="project-summary-cta">
                  {buildSessionOpenLabel(summary)}
                </p>
              </button>
            );
          })}
        </section>
      );
    }

    if (activePage === "new-analysis") {
      return (
        <section className="analysis-launch-layout">
          <article className="utility-block analysis-primary-card">
            <div className="panel-header analysis-primary-header">
              <div>
                <span className="detail-label">Analysis launch</span>
                <h2>Analyze a local backlog VOD</h2>
                <p>
                  Stage one local recording, confirm the profile and session
                  title, then open the returned session directly into review.
                </p>
              </div>
              <button
                className="button-secondary"
                disabled={isAnalyzing}
                onClick={() => {
                  void handlePickMedia();
                }}
                type="button"
              >
                Choose Local Recording
              </button>
            </div>

            <div className="analysis-form">
              <label className="search-block">
                <span className="input-label">Local media path</span>
                <input
                  className="search-input"
                  disabled={isAnalyzing}
                  onChange={(event) => {
                    setSelectedMediaPath(event.target.value);
                    setAnalysisError(null);
                  }}
                  placeholder="/Users/you/VODs/session-2026-03-25.mkv"
                  type="text"
                  value={selectedMediaPath}
                />
                <small
                  className={
                    analysisLaunchState.canAnalyze
                      ? "analysis-field-note ready"
                      : "analysis-field-note"
                  }
                >
                  {normalizedSelectedMediaPath
                    ? isSupportedInput(normalizedSelectedMediaPath)
                      ? `Detected ${analysisSourceName} • supported input`
                      : `Unsupported file type. Use one of: ${supportedInputExtensions.join(", ")}`
                    : `Supported inputs: ${supportedInputExtensions.join(", ")}`}
                </small>
              </label>

              <div className="analysis-inline-grid">
                <label className="search-block">
                  <span className="input-label">Profile</span>
                  <select
                    className="search-input"
                    disabled={isAnalyzing || !hasPersistedProfiles}
                    onChange={(event) => {
                      setAnalysisProfileId(event.target.value);
                      setAnalysisError(null);
                    }}
                    value={hasPersistedProfiles ? analysisProfileId : ""}
                  >
                    {hasPersistedProfiles ? (
                      availableProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {isLoadingProfiles
                          ? "Loading persisted profiles..."
                          : "No persisted profiles available"}
                      </option>
                    )}
                  </select>
                  <small className="analysis-field-note">
                    {hasPersistedProfiles
                      ? "Profiles come from the persisted local library."
                      : isLoadingProfiles
                        ? "Waiting for persisted profiles from the local API."
                        : "No persisted profiles are available yet."}
                  </small>
                </label>

                <label className="search-block">
                  <span className="input-label">Session title</span>
                  <input
                    className="search-input"
                    disabled={isAnalyzing}
                    onChange={(event) => {
                      setAnalysisTitle(event.target.value);
                      setAnalysisError(null);
                    }}
                    placeholder="Optional: Backlog pass 01"
                    type="text"
                    value={analysisTitle}
                  />
                  <small className="analysis-field-note">
                    Leave blank to reuse the source file name as the session
                    title.
                  </small>
                </label>
              </div>

              <div className="analysis-summary-grid analysis-summary-grid-compact">
                <article className="analysis-summary-card">
                  <span className="detail-label">Selected source</span>
                  <strong>
                    {analysisSourceName ?? "No local recording staged"}
                  </strong>
                  <p className="analysis-summary-path">
                    {normalizedSelectedMediaPath ||
                      "Choose a supported local VOD path or use the file picker."}
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Profile</span>
                  <strong>{selectedDraftProfile.name}</strong>
                  <p>{selectedDraftProfile.description}</p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Session title</span>
                  <strong>{analysisTitlePreview}</strong>
                  <p>
                    {analysisTitle.trim()
                      ? "Using your custom session title."
                      : "Blank titles fall back to the source file name."}
                  </p>
                </article>
              </div>

              <div className="analysis-primary-actions">
                <button
                  className="button-primary"
                  disabled={isAnalyzing || !analysisLaunchState.canAnalyze}
                  onClick={() => {
                    void handleAnalyze();
                  }}
                  type="button"
                >
                  {isAnalyzing
                    ? "Analyzing local VOD..."
                    : "Run Local Analysis"}
                </button>
                <p className="analysis-support-copy">
                  HighlightSmith will create one persisted session and open it
                  directly into timeline, queue, and detail review.
                </p>
              </div>

              {analysisError ? (
                <p className="analysis-error">{analysisError}</p>
              ) : null}
            </div>
          </article>

          <div className="analysis-secondary-stack">
            <article
              className={`analysis-readiness-card ${analysisLaunchState.tone}`}
            >
              <div className="analysis-readiness-header">
                <div>
                  <span className="detail-label">Launch readiness</span>
                  <strong>{analysisLaunchState.headline}</strong>
                  <p className="analysis-readiness-copy">
                    {analysisLaunchState.detail}
                  </p>
                </div>
                <span
                  className={`analysis-readiness-pill ${analysisLaunchState.tone}`}
                >
                  {analysisLaunchState.statusLabel}
                </span>
              </div>
            </article>

            <article className="utility-block">
              <span className="detail-label">What happens next</span>
              <ol className="plain-list ordered">
                <li>Desktop sends the local file path to the API bridge.</li>
                <li>
                  The analyzer inspects the file and persists one session in
                  SQLite.
                </li>
                <li>
                  The returned session opens directly into timeline, queue, and
                  detail review.
                </li>
              </ol>
              <p>Local API target: {apiBaseUrl}/api/projects/analyze</p>
              {projectSession ? (
                <p>
                  Loaded session: {projectSession.title} •{" "}
                  {projectSession.candidates.length} candidates •{" "}
                  {activeSessionReviewStateLabel ?? "Pending"}
                </p>
              ) : (
                <p>No analyzer-backed session loaded yet.</p>
              )}
            </article>
          </div>
        </section>
      );
    }

    if (activePage === "candidate-detail") {
      return (
        <section className="desktop-review-stack">
          {projectSession && activeSessionReviewState ? (
            <SessionOverview
              acceptedCount={acceptedCount}
              pendingCount={pendingReviewCount}
              profile={currentProfile}
              profileMatchingSummary={profileMatchingSummary}
              rejectedCount={rejectedCount}
              reviewStateLabel={activeSessionReviewStateLabel ?? "Pending"}
              reviewStateTone={activeSessionReviewState}
              selectedCandidateIndex={selectedCandidateIndex}
              session={projectSession}
            />
          ) : null}
          <CandidateTimeline
            candidates={sessionCandidates}
            decisionsByCandidateId={decisionsByCandidateId}
            durationSeconds={projectSession?.mediaSource.durationSeconds ?? 0}
            onSelectCandidate={handleSelectCandidate}
            selectedCandidateId={selectedCandidate?.id ?? null}
          />
          <CandidateDetail
            candidate={selectedCandidate}
            candidateCount={sessionCandidates.length}
            candidateIndex={Math.max(selectedCandidateIndex, 0)}
            decision={selectedDecision}
            exportPreview={timestampPreview}
            presentationMode={presentationMode}
            profileMatchingSummary={profileMatchingSummary}
            reviewQueueMode={reviewQueueMode}
            selectedCandidateVisibleInQueue={selectedCandidateVisibleInQueue}
            transcript={projectSession?.transcript ?? []}
            pendingCount={pendingReviewCount}
            nextPendingSession={nextPendingSession}
            labelDraft={
              selectedCandidate ? (labelDrafts[selectedCandidate.id] ?? "") : ""
            }
            onAccept={handleAccept}
            onExpandResolution={handleExpandResolution}
            onExpandSetup={handleExpandSetup}
            isSavingReview={isSavingReview}
            onLabelChange={handleLabelChange}
            onOpenNextPendingSession={() => {
              void handleOpenNextPendingSession();
            }}
            onSelectNextVisible={handleSelectNextVisible}
            onSelectPreviousVisible={handleSelectPreviousVisible}
            onReject={handleReject}
            onSaveLabel={handleSaveLabel}
            onSelectNextPending={handleSelectNextPending}
            onReturnToProjects={handleReturnToProjects}
            profile={currentProfile}
            reviewError={reviewError}
            visibleCandidateCount={queueCandidates.length}
          />
        </section>
      );
    }

    if (activePage === "profiles") {
      return (
        <ProfileWorkspace
          libraryAssets={mediaLibraryAssets}
          mediaIndexJobs={mediaIndexJobs}
          mediaAlignmentJobs={mediaAlignmentJobs}
          mediaAlignmentMatches={mediaAlignmentMatches}
          mediaEditPairs={mediaEditPairs}
          cancellingMediaIndexJobIds={cancellingMediaIndexJobIds}
          cancellingMediaAlignmentJobIds={cancellingMediaAlignmentJobIds}
          savingThumbnailOutputAssetIds={savingThumbnailOutputAssetIds}
          error={profileLibraryError}
          examples={selectedProfileExamples}
          isAddingExample={isAddingProfileExample}
          isCreatingProfile={isCreatingProfile}
          isCreatingMediaAsset={isCreatingMediaLibraryAsset}
          isCreatingMediaIndexJob={isCreatingMediaIndexJob}
          isCreatingMediaAlignmentJob={isCreatingMediaAlignmentJob}
          isCreatingMediaPair={isCreatingMediaEditPair}
          isLoadingExamples={isLoadingProfileExamples}
          isLoadingMediaIndexJobs={isLoadingMediaIndexJobs}
          isLoadingMediaAlignmentJobs={isLoadingMediaAlignmentJobs}
          isLoadingLibraryAssets={isLoadingMediaLibraryAssets}
          isLoadingMediaPairs={isLoadingMediaEditPairs}
          isLoadingProfiles={isLoadingProfiles}
          onAddExample={handleAddProfileExample}
          onCancelMediaAlignmentJob={handleCancelMediaAlignmentJob}
          onCancelMediaIndexJob={handleCancelMediaIndexJob}
          onCreateProfile={handleCreateProfile}
          onCreateMediaAsset={handleCreateMediaLibraryAsset}
          onCreateMediaAlignmentJob={handleCreateMediaAlignmentJob}
          onCreateMediaIndexJob={handleCreateMediaIndexJob}
          onReplaceThumbnailOutputs={handleReplaceMediaThumbnailOutputs}
          onCreateMediaPair={handleCreateMediaEditPair}
          onSelectProfile={setSelectedProfileId}
          profiles={availableProfiles}
          selectedProfile={selectedProfile}
          selectedProfileId={selectedProfileId}
        />
      );
    }

    if (activePage === "settings") {
      return (
        <section className="desktop-placeholder-grid">
          <article className="utility-block">
            <span className="detail-label">Current analyzer defaults</span>
            <p>
              Offline only:{" "}
              {String(projectSession?.settings.runOfflineOnly ?? true)} • micro
              window {projectSession?.settings.microWindowSeconds ?? 2}s •
              candidate window{" "}
              {projectSession?.settings.candidateWindowMinSeconds ?? 15}-
              {projectSession?.settings.candidateWindowMaxSeconds ?? 45}s
            </p>
          </article>
          <article className="utility-block">
            <span className="detail-label">Storage direction</span>
            <p>
              SQLite schema v{sqliteSchemaVersion} with {sqliteTables.length}{" "}
              planned tables. Desktop review actions now persist through the
              local analyzer-backed SQLite session store.
            </p>
          </article>
        </section>
      );
    }

    return (
      <section className="desktop-review-stack">
        {projectSession && activeSessionReviewState ? (
          <SessionOverview
            acceptedCount={acceptedCount}
            pendingCount={pendingReviewCount}
            profile={currentProfile}
            profileMatchingSummary={profileMatchingSummary}
            rejectedCount={rejectedCount}
            reviewStateLabel={activeSessionReviewStateLabel ?? "Pending"}
            reviewStateTone={activeSessionReviewState}
            selectedCandidateIndex={selectedCandidateIndex}
            session={projectSession}
          />
        ) : null}
        <CandidateTimeline
          candidates={sessionCandidates}
          decisionsByCandidateId={decisionsByCandidateId}
          durationSeconds={projectSession?.mediaSource.durationSeconds ?? 0}
          onSelectCandidate={handleSelectCandidate}
          selectedCandidateId={selectedCandidate?.id ?? null}
        />
        <div className="desktop-review-grid">
          <CandidateQueue
            bandFilter={bandFilter}
            candidates={queueCandidates}
            decisionsByCandidateId={decisionsByCandidateId}
            deferredSearchValue={deferredSearchValue}
            isStrongMatchFallback={isStrongMatchFallback}
            matchingCandidateCount={searchFilteredCandidates.length}
            onSelectNextPending={handleSelectNextPending}
            onBandFilterChange={setBandFilter}
            onPresentationModeChange={setPresentationMode}
            onReviewQueueModeChange={handleReviewQueueModeChange}
            onSearchChange={handleSearchChange}
            onSelectCandidate={handleSelectCandidate}
            pendingCount={pendingReviewCount}
            profile={currentProfile}
            profileMatchingSummary={profileMatchingSummary}
            presentationMode={presentationMode}
            reviewQueueMode={reviewQueueMode}
            reviewedCount={reviewedCount}
            searchValue={searchValue}
            selectedCandidateVisibleInQueue={selectedCandidateVisibleInQueue}
            selectedCandidateId={selectedCandidate?.id ?? null}
            totalCandidateCount={sessionCandidates.length}
          />

          <CandidateDetail
            candidate={selectedCandidate}
            candidateCount={sessionCandidates.length}
            candidateIndex={Math.max(selectedCandidateIndex, 0)}
            decision={selectedDecision}
            exportPreview={timestampPreview}
            presentationMode={presentationMode}
            profileMatchingSummary={profileMatchingSummary}
            reviewQueueMode={reviewQueueMode}
            selectedCandidateVisibleInQueue={selectedCandidateVisibleInQueue}
            transcript={projectSession?.transcript ?? []}
            pendingCount={pendingReviewCount}
            nextPendingSession={nextPendingSession}
            labelDraft={
              selectedCandidate ? (labelDrafts[selectedCandidate.id] ?? "") : ""
            }
            onAccept={handleAccept}
            onExpandResolution={handleExpandResolution}
            onExpandSetup={handleExpandSetup}
            isSavingReview={isSavingReview}
            onLabelChange={handleLabelChange}
            onOpenNextPendingSession={() => {
              void handleOpenNextPendingSession();
            }}
            onSelectNextVisible={handleSelectNextVisible}
            onSelectPreviousVisible={handleSelectPreviousVisible}
            onReject={handleReject}
            onSaveLabel={handleSaveLabel}
            onSelectNextPending={handleSelectNextPending}
            onReturnToProjects={handleReturnToProjects}
            profile={currentProfile}
            reviewError={reviewError}
            visibleCandidateCount={queueCandidates.length}
          />
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <LayoutShell
        activeId={activePage}
        appName="HighlightSmith"
        aside={
          <div className="desktop-aside-stack">
            <article className="utility-block">
              <span className="detail-label">Current source</span>
              <p>{selectedMediaPath || "No local recording selected yet."}</p>
              <p>
                {sessionCandidates.length} candidates • {acceptedCount} accepted
              </p>
            </article>
            <TranscriptSnippetBlock
              heading="Current transcript focus"
              text={
                selectedCandidate?.transcriptSnippet ??
                "Select a candidate to inspect transcript context."
              }
            />
            <article className="utility-block">
              <span className="detail-label">Export preview</span>
              <details>
                <summary>Timestamp export</summary>
                <pre>
                  {timestampPreview ||
                    "Run an analysis to generate export data."}
                </pre>
              </details>
              <details>
                <summary>JSON candidate export</summary>
                <pre>
                  {jsonPreview || "Run an analysis to generate export data."}
                </pre>
              </details>
            </article>
          </div>
        }
        navItems={desktopPages}
        onSelect={(pageId) => setActivePage(pageId as DesktopPage)}
        subtitle="Local-first analysis launch, session review, and backlog clearing."
        title="Desktop Review"
      >
        <ShellHeader
          activeSessionStateLabel={
            activeSessionReviewStateLabel
              ? activeSessionReviewStateLabel
              : normalizedSelectedMediaPath
                ? "Local VOD staged for analysis"
                : "Choose a local file or reopen a backlog session."
          }
          acceptedCount={acceptedCount}
          currentProfileLabel={currentProfile.name}
          currentSessionLabel={projectSession?.title ?? "No session loaded"}
          onPickMedia={handlePickMedia}
          onToggleTheme={() =>
            setThemeMode((current) => (current === "dark" ? "light" : "dark"))
          }
          pendingCount={pendingReviewCount}
          rejectedCount={rejectedCount}
          selectedMediaPath={
            selectedMediaPath || "No local recording selected yet."
          }
          themeMode={themeMode}
          totalCount={sessionCandidates.length}
        />
        {renderDesktopPage()}
      </LayoutShell>
    </div>
  );
}

function resolveInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedThemeMode = window.localStorage.getItem(themeModeStorageKey);
  return savedThemeMode === "light" ? "light" : "dark";
}

function buildSuggestedSessionTitle(sourcePath: string): string {
  return extractSourceName(sourcePath).replace(/\.[^.]+$/, "");
}

function extractSourceName(sourcePath: string): string {
  return sourcePath.split(/[\\/]/).pop() ?? sourcePath;
}

function buildAnalysisLaunchState(
  sourcePath: string,
  options: {
    hasPersistedProfiles: boolean;
    isLoadingProfiles: boolean;
  },
): AnalysisReadiness {
  if (options.isLoadingProfiles) {
    return {
      canAnalyze: false,
      detail: "Waiting for the persisted profile library from the local API.",
      headline: "Loading profiles",
      statusLabel: "Loading",
      tone: "blocked",
    };
  }

  if (!options.hasPersistedProfiles) {
    return {
      canAnalyze: false,
      detail: "Create or load a persisted clip profile before starting analysis.",
      headline: "No profiles available",
      statusLabel: "Needs profile",
      tone: "blocked",
    };
  }

  if (!sourcePath) {
    return {
      canAnalyze: false,
      detail: "Choose a supported local recording before starting analysis.",
      headline: "Select a local recording",
      statusLabel: "Needs source",
      tone: "blocked",
    };
  }

  if (!isSupportedInput(sourcePath)) {
    return {
      canAnalyze: false,
      detail: `Unsupported media extension. Use one of: ${supportedInputExtensions.join(", ")}`,
      headline: "Unsupported input type",
      statusLabel: "Fix input",
      tone: "blocked",
    };
  }

  return {
    canAnalyze: true,
    detail:
      "Desktop will send this local file path to the API bridge, then open the persisted analyzer session directly into review.",
    headline: "Ready to analyze locally",
    statusLabel: "Ready",
    tone: "ready",
  };
}

function buildLabelDrafts(session: ProjectSession): Record<string, string> {
  const decisionLabelsByCandidateId = Object.fromEntries(
    session.reviewDecisions
      .filter((decision) => Boolean(decision.label))
      .map((decision) => [decision.candidateId, decision.label as string]),
  );

  return Object.fromEntries(
    session.candidates.map((candidate) => [
      candidate.id,
      decisionLabelsByCandidateId[candidate.id] ?? candidate.editableLabel,
    ]),
  );
}

async function fetchProfiles(apiBaseUrl: string): Promise<ClipProfile[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/profiles`,
    apiBaseUrl,
    undefined,
    "Unable to load clip profiles.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | ClipProfile[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Profile list load failed",
    );
  }

  return clipProfileSchema.array().parse(payload);
}

async function fetchProfileExamples(
  apiBaseUrl: string,
  profileId: string,
): Promise<ExampleClip[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/profiles/${encodeURIComponent(profileId)}/examples`,
    apiBaseUrl,
    undefined,
    "Unable to load profile examples.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | ExampleClip[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Profile example list load failed",
    );
  }

  return exampleClipSchema.array().parse(payload);
}

async function createProfile(
  apiBaseUrl: string,
  input: CreateClipProfileRequest,
): Promise<ClipProfile> {
  const request = createClipProfileRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/profiles`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Unable to create clip profile.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | ClipProfile
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Profile create failed",
    );
  }

  return clipProfileSchema.parse(payload);
}

async function createProfileExample(
  apiBaseUrl: string,
  profileId: string,
  input: AddExampleClipRequest,
): Promise<ExampleClip> {
  const request = addExampleClipRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/profiles/${encodeURIComponent(profileId)}/examples`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Unable to save example clip reference.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | ExampleClip
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Profile example create failed",
    );
  }

  return exampleClipSchema.parse(payload);
}

async function fetchMediaLibraryAssets(
  apiBaseUrl: string,
): Promise<MediaLibraryAsset[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/assets`,
    apiBaseUrl,
    undefined,
    "Unable to load media library assets.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaLibraryAsset[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media library asset list load failed",
    );
  }

  return mediaLibraryAssetSchema.array().parse(payload);
}

async function createMediaLibraryAssetEntry(
  apiBaseUrl: string,
  input: CreateMediaLibraryAssetRequest,
): Promise<MediaLibraryAsset> {
  const request = createMediaLibraryAssetRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/assets`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Unable to save media library asset.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaLibraryAsset
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media library asset create failed",
    );
  }

  return mediaLibraryAssetSchema.parse(payload);
}

async function replaceMediaThumbnailOutputsEntry(
  apiBaseUrl: string,
  assetId: string,
  input: ReplaceMediaThumbnailOutputsRequest,
): Promise<MediaLibraryAsset> {
  const request = replaceMediaThumbnailOutputsRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/assets/${encodeURIComponent(assetId)}/thumbnail-outputs`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Unable to update chosen thumbnail outputs.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaLibraryAsset
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Thumbnail output update failed",
    );
  }

  return mediaLibraryAssetSchema.parse(payload);
}

async function fetchMediaEditPairs(apiBaseUrl: string): Promise<MediaEditPair[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/pairs`,
    apiBaseUrl,
    undefined,
    "Unable to load VOD/edit pairs.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaEditPair[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "VOD/edit pair list load failed",
    );
  }

  return mediaEditPairSchema.array().parse(payload);
}

async function createMediaEditPairEntry(
  apiBaseUrl: string,
  input: CreateMediaEditPairRequest,
): Promise<MediaEditPair> {
  const request = createMediaEditPairRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/pairs`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Unable to save VOD/edit pair.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaEditPair
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "VOD/edit pair create failed",
    );
  }

  return mediaEditPairSchema.parse(payload);
}

async function fetchMediaIndexJobs(
  apiBaseUrl: string,
): Promise<MediaIndexJob[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/index-jobs`,
    apiBaseUrl,
    undefined,
    "Unable to load media index jobs.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaIndexJob[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media index job list load failed",
    );
  }

  return mediaIndexJobSchema.array().parse(payload);
}

async function createMediaIndexJobEntry(
  apiBaseUrl: string,
  input: CreateMediaIndexJobRequest,
): Promise<MediaIndexJob> {
  const request = createMediaIndexJobRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/assets/${encodeURIComponent(request.assetId)}/index-jobs`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    },
    "Unable to start media index job.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaIndexJob
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media index job create failed",
    );
  }

  return mediaIndexJobSchema.parse(payload);
}

async function cancelMediaIndexJobEntry(
  apiBaseUrl: string,
  input: CancelMediaIndexJobRequest,
): Promise<MediaIndexJob> {
  const request = cancelMediaIndexJobRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/index-jobs/${encodeURIComponent(request.jobId)}/cancel`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    },
    "Unable to cancel media index job.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaIndexJob
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media index job cancel failed",
    );
  }

  return mediaIndexJobSchema.parse(payload);
}

async function fetchMediaAlignmentJobs(
  apiBaseUrl: string,
): Promise<MediaAlignmentJob[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/alignment-jobs`,
    apiBaseUrl,
    undefined,
    "Unable to load media alignment jobs.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaAlignmentJob[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media alignment job list load failed",
    );
  }

  return mediaAlignmentJobSchema.array().parse(payload);
}

async function fetchMediaAlignmentMatches(
  apiBaseUrl: string,
): Promise<MediaAlignmentMatch[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/alignment-matches`,
    apiBaseUrl,
    undefined,
    "Unable to load media alignment matches.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaAlignmentMatch[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media alignment match list load failed",
    );
  }

  return mediaAlignmentMatchSchema.array().parse(payload);
}

async function createMediaAlignmentJobEntry(
  apiBaseUrl: string,
  input: CreateMediaAlignmentJobRequest,
): Promise<MediaAlignmentJob> {
  const request = createMediaAlignmentJobRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    request.pairId
      ? `${apiBaseUrl}/api/library/pairs/${encodeURIComponent(request.pairId)}/alignment-jobs`
      : `${apiBaseUrl}/api/library/alignment-jobs`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Unable to start media alignment job.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaAlignmentJob
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media alignment job create failed",
    );
  }

  return mediaAlignmentJobSchema.parse(payload);
}

async function cancelMediaAlignmentJobEntry(
  apiBaseUrl: string,
  input: CancelMediaAlignmentJobRequest,
): Promise<MediaAlignmentJob> {
  const request = cancelMediaAlignmentJobRequestSchema.parse(input);
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/library/alignment-jobs/${encodeURIComponent(request.jobId)}/cancel`,
    apiBaseUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    },
    "Unable to cancel media alignment job.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | MediaAlignmentJob
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Media alignment job cancel failed",
    );
  }

  return mediaAlignmentJobSchema.parse(payload);
}

async function fetchProjectSession(
  apiBaseUrl: string,
  sessionId: string,
): Promise<ProjectSession> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/projects/${encodeURIComponent(sessionId)}`,
    apiBaseUrl,
    undefined,
    "Unable to load the local session.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | ProjectSession
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Session load failed",
    );
  }

  return projectSessionSchema.parse(payload);
}

async function fetchProjectSummaries(
  apiBaseUrl: string,
): Promise<ProjectSessionSummary[]> {
  const response = await fetchWithLocalApiMessage(
    `${apiBaseUrl}/api/projects`,
    apiBaseUrl,
    undefined,
    "Unable to load persisted sessions.",
  );
  const payload = (await response.json().catch(() => null)) as
    | {
        message?: string;
      }
    | ProjectSessionSummary[]
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "message" in payload && payload.message
        ? payload.message
        : "Project list load failed",
    );
  }

  return projectSessionSummarySchema.array().parse(payload);
}

function upsertProjectSummary(
  current: ProjectSessionSummary[],
  nextSummary: ProjectSessionSummary,
): ProjectSessionSummary[] {
  const merged = [
    nextSummary,
    ...current.filter((summary) => summary.sessionId !== nextSummary.sessionId),
  ];

  return merged.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function upsertProfile(
  current: ClipProfile[],
  nextProfile: ClipProfile,
): ClipProfile[] {
  const merged = [
    nextProfile,
    ...current.filter((profile) => profile.id !== nextProfile.id),
  ];

  return merged.sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "SYSTEM" ? -1 : 1;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function upsertMediaLibraryAsset(
  current: MediaLibraryAsset[],
  nextAsset: MediaLibraryAsset,
): MediaLibraryAsset[] {
  const merged = [
    nextAsset,
    ...current.filter((asset) => asset.id !== nextAsset.id),
  ];

  return merged.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function upsertMediaEditPair(
  current: MediaEditPair[],
  nextPair: MediaEditPair,
): MediaEditPair[] {
  const merged = [
    nextPair,
    ...current.filter((pair) => pair.id !== nextPair.id),
  ];

  return merged.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function upsertMediaIndexJob(
  current: MediaIndexJob[],
  nextJob: MediaIndexJob,
): MediaIndexJob[] {
  const merged = [
    nextJob,
    ...current.filter((job) => job.id !== nextJob.id),
  ];

  return merged.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function upsertMediaAlignmentJob(
  current: MediaAlignmentJob[],
  nextJob: MediaAlignmentJob,
): MediaAlignmentJob[] {
  const merged = [
    nextJob,
    ...current.filter((job) => job.id !== nextJob.id),
  ];

  return merged.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function formatSessionReviewState(
  sessionReviewState: ReturnType<typeof deriveSessionReviewState>,
): string {
  if (sessionReviewState === "REVIEWED") {
    return "Reviewed";
  }

  if (sessionReviewState === "IN_PROGRESS") {
    return "In progress";
  }

  return "Pending";
}

function buildSessionOpenLabel(summary: ProjectSessionSummary): string {
  const sessionReviewState = deriveSessionReviewState(summary);
  if (sessionReviewState === "REVIEWED") {
    return "Open reviewed session";
  }

  if (sessionReviewState === "IN_PROGRESS") {
    return "Resume review";
  }

  return "Start review";
}

function resolveProfile(
  profiles: ClipProfile[],
  profileId: string,
): ClipProfile {
  return (
    profiles.find((profile) => profile.id === profileId) ?? {
      id: profileId,
      name: "Profile unavailable",
      label: profileId,
      description:
        "Profile metadata is unavailable locally. Reload the persisted profile library from the local API.",
      createdAt: "",
      updatedAt: "",
      state: "ACTIVE",
      source: "USER",
      mode: "EXAMPLE_DRIVEN",
      signalWeights: {},
      exampleClips: [],
    }
  );
}

function formatSessionCompletion(summary: ProjectSessionSummary): number {
  if (summary.candidateCount === 0) {
    return 0;
  }

  return Math.round(
    (reviewedCandidateCount(summary) / summary.candidateCount) * 100,
  );
}

function buildProjectCoverageCopy(summary: ProjectSessionSummary): string {
  return summarizeSessionQuality(
    summary.analysisCoverage,
    summary.candidateCount,
  );
}

function findFirstPendingCandidateId(session: ProjectSession): string | null {
  return (
    session.candidates.find((candidate) =>
      isCandidatePending(session, candidate.id),
    )?.id ?? null
  );
}

function findNextPendingCandidateId(
  session: ProjectSession,
  currentCandidateId: string | null,
): string | null {
  return findNextCandidateId(session, currentCandidateId, (candidateId) =>
    isCandidatePending(session, candidateId),
  );
}

function findNextCandidateId(
  session: ProjectSession,
  currentCandidateId: string | null,
  predicate?: (candidateId: string) => boolean,
): string | null {
  if (session.candidates.length === 0) {
    return null;
  }

  const startIndex = currentCandidateId
    ? session.candidates.findIndex(
        (candidate) => candidate.id === currentCandidateId,
      )
    : -1;

  for (let offset = 1; offset <= session.candidates.length; offset += 1) {
    const candidate =
      session.candidates[
        (Math.max(startIndex, -1) + offset) % session.candidates.length
      ];
    if (!predicate || predicate(candidate.id)) {
      return candidate.id;
    }
  }

  return null;
}

function findAdjacentVisibleCandidateId(
  candidates: Array<{
    id: string;
  }>,
  currentCandidateId: string | null,
  direction: -1 | 1,
): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const currentIndex = currentCandidateId
    ? candidates.findIndex((candidate) => candidate.id === currentCandidateId)
    : -1;

  if (currentIndex === -1) {
    return direction === 1
      ? (candidates[0]?.id ?? null)
      : (candidates[candidates.length - 1]?.id ?? null);
  }

  const nextIndex =
    (currentIndex + direction + candidates.length) % candidates.length;
  return candidates[nextIndex]?.id ?? null;
}

function formatSummaryTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
