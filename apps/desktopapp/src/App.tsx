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
import { LayoutShell, TranscriptSnippetBlock } from "@highlightsmith/ui";
import { CandidateDetail } from "./components/CandidateDetail";
import { CandidateQueue } from "./components/CandidateQueue";
import {
  MomentPreviewModal,
  type MomentPreviewMode,
} from "./components/MomentPreviewModal";
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
  | "profiles";
type AnalysisReadiness = {
  canAnalyze: boolean;
  statusLabel: string;
  headline: string;
  detail: string;
  tone: "ready" | "blocked";
};
type StartGuide = {
  statusLabel: string;
  headline: string;
  detail: string;
  steps: string[];
  ctaLabel: string | null;
  ctaAction: "references" | "pick-media" | null;
};
type ThemeMode = "dark" | "light";

const lastSessionIdStorageKey = "highlightsmith.desktop.last-session-id";
const themeModeStorageKey = "highlightsmith.desktop.theme-mode";
const desktopPages: Array<{ id: DesktopPage; label: string }> = [
  { id: "new-analysis", label: "Start" },
  { id: "candidate-review", label: "Review" },
  { id: "profiles", label: "References" },
  { id: "projects", label: "Backlog" },
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
    useState<ReviewQueueMode>("ONLY_PENDING");
  const [presentationMode, setPresentationMode] =
    useState<ProfilePresentationMode>("ALL_CANDIDATES");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [selectedMediaPath, setSelectedMediaPath] = useState("");
  const [momentPreviewState, setMomentPreviewState] = useState<{
    candidateId: string;
    mode: MomentPreviewMode;
  } | null>(null);
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
  const hasSavedSessions = projectSummaries.length > 0;
  const hasReferenceMaterial =
    availableProfiles.some((profile) => profile.exampleClips.length > 0) ||
    mediaLibraryAssets.some(
      (asset) =>
        asset.scope === "PROFILE" &&
        (asset.assetType === "CLIP" || asset.assetType === "EDIT"),
    );
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
  const startGuide = buildStartGuide({
    hasPersistedProfiles,
    hasReferenceMaterial,
    hasSavedSessions,
    hasSelectedVideo: Boolean(normalizedSelectedMediaPath),
  });
  const showStartGuide =
    !hasSavedSessions || !hasPersistedProfiles || !hasReferenceMaterial;
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
  const previewCandidate = momentPreviewState
    ? sessionCandidates.find(
        (candidate) => candidate.id === momentPreviewState.candidateId,
      ) ?? null
    : null;
  const previewDecision = previewCandidate
    ? decisionsByCandidateId[previewCandidate.id]
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
            ? `Unable to load saved sessions: ${error.message}`
            : "Unable to load saved sessions",
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
            ? `Unable to load background activity: ${error.message}`
            : "Unable to load background activity",
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
    if (activePage === "candidate-review") {
      return;
    }

    setMomentPreviewState(null);
  }, [activePage]);

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

  useEffect(() => {
    if (activePage !== "candidate-review") {
      return;
    }

    function handleReviewKeydown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "/") {
        const searchInput = document.getElementById(
          "review-search-input",
        ) as HTMLInputElement | null;
        if (!searchInput) {
          return;
        }

        event.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "k") {
        event.preventDefault();
        handleAccept();
        return;
      }

      if (normalizedKey === "x") {
        event.preventDefault();
        handleReject();
        return;
      }

      if (normalizedKey === "v") {
        event.preventDefault();
        handleOpenMomentPreview(selectedCandidate?.id ?? null);
        return;
      }

      if (normalizedKey === "n") {
        event.preventDefault();
        handleSelectNextPending();
        return;
      }

      if (normalizedKey === "j") {
        event.preventDefault();
        handleSelectPreviousVisible();
        return;
      }

      if (normalizedKey === "l") {
        event.preventDefault();
        handleSelectNextVisible();
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        handleExpandSetup();
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        handleExpandResolution();
      }
    }

    window.addEventListener("keydown", handleReviewKeydown);
    return () => {
      window.removeEventListener("keydown", handleReviewKeydown);
    };
  }, [
    activePage,
    handleAccept,
    handleExpandResolution,
    handleExpandSetup,
    handleOpenMomentPreview,
    handleReject,
    handleSelectNextPending,
    handleSelectNextVisible,
    handleSelectPreviousVisible,
    selectedCandidate?.id,
  ]);

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
          : "Something went wrong while creating the profile.",
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
          : "Something went wrong while saving the clip.",
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
          : "Something went wrong while saving the media reference.",
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
          : "Something went wrong while saving the VOD/edit comparison.",
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
          : "Something went wrong while starting background analysis.",
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
          : "Something went wrong while updating thumbnail picks.",
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
          : "Something went wrong while cancelling the background job.",
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
          : "Something went wrong while starting the VOD/edit comparison.",
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
          : "Something went wrong while cancelling the comparison job.",
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

  function handleOpenMomentPreview(
    candidateId: string | null,
    mode: MomentPreviewMode = "SUGGESTED_SEGMENT",
  ) {
    if (!candidateId) {
      return;
    }

    setSelectedCandidateId(candidateId);
    setMomentPreviewState({
      candidateId,
      mode,
    });
  }

  function handleCloseMomentPreview() {
    setMomentPreviewState(null);
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
    setMomentPreviewState(null);
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
          : "Something went wrong while starting the scan.",
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
          : "Something went wrong while opening the session.",
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
              <span className="detail-label">Backlog</span>
              <h2>Loading saved review sessions...</h2>
            </article>
          ) : null}
          {projectsError ? (
            <article className="utility-block">
              <span className="detail-label">Backlog</span>
              <p className="analysis-error">{projectsError}</p>
            </article>
          ) : null}
          {!isLoadingProjects &&
          !projectsError &&
          projectSummaries.length === 0 ? (
            <article className="utility-block">
              <span className="detail-label">Backlog</span>
              <h2>No saved review sessions yet</h2>
              <p>
                Scan a video to create your first review session.
              </p>
            </article>
          ) : null}
          {!isLoadingProjects &&
          !projectsError &&
          projectSummaries.length > 0 ? (
            <article className="utility-block backlog-shortcut-card">
              <div className="panel-header">
                <div>
                  <span className="detail-label">Backlog</span>
                  <h2>
                    {nextPendingSession
                      ? "Continue the next session that still needs decisions"
                      : "Your backlog is clear"}
                  </h2>
                  <p>
                    {nextPendingSession
                      ? `${pendingSessionCount} saved session${pendingSessionCount === 1 ? "" : "s"} still have undecided moments.`
                      : "Every saved session currently has decisions for all suggested moments."}
                  </p>
                </div>
                <span className="queue-count">
                  {pendingSessionCount} open
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
                    Continue next session
                  </button>
                ) : (
                  <button
                    className="button-secondary"
                    onClick={() => setActivePage("new-analysis")}
                    type="button"
                  >
                    Scan another video
                  </button>
                )}
              </div>
              <p className="project-summary-cta">
                {nextPendingSession
                  ? `${nextPendingSession.sessionTitle} • ${nextPendingSession.pendingCount} undecided • updated ${formatSummaryTimestamp(nextPendingSession.updatedAt)}`
                  : "Use Start to add the next review session."}
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
                  <span className="detail-label">Saved session</span>
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
                  {summary.candidateCount} moments • {summary.acceptedCount}{" "}
                  kept • {summary.rejectedCount} skipped •{" "}
                  {summary.pendingCount} undecided
                </p>
                <p
                  className={`project-summary-coverage ${analysisCoverageTone(summary.analysisCoverage)}`}
                >
                  {buildProjectCoverageCopy(summary)}
                </p>
                <p>
                  Reference profile {profile.name} • updated{" "}
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
                <span className="detail-label">Start</span>
                <h2>Scan a video</h2>
                <p>
                  Choose one local video, pick the reference profile you want
                  HS to lean on, and open the results directly into review.
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
                Choose video
              </button>
            </div>

            <div className="analysis-form">
              <label className="search-block">
                <span className="input-label">Video file</span>
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
                  <span className="input-label">Reference profile</span>
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
                          ? "Loading saved profiles..."
                          : "No saved profiles yet"}
                      </option>
                    )}
                  </select>
                  <small className="analysis-field-note">
                    {hasPersistedProfiles
                      ? "Profiles help HS lean toward the kinds of moments you usually keep."
                      : isLoadingProfiles
                        ? "Loading saved profiles."
                        : "Create a profile first so HS has some direction."}
                  </small>
                </label>

                <label className="search-block">
                  <span className="input-label">Session name</span>
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
                    Leave this blank if the file name is already good enough.
                  </small>
                </label>
              </div>

              <div className="analysis-summary-grid analysis-summary-grid-compact">
                <article className="analysis-summary-card">
                  <span className="detail-label">Video</span>
                  <strong>
                    {analysisSourceName ?? "No video chosen"}
                  </strong>
                  <p className="analysis-summary-path">
                    {normalizedSelectedMediaPath ||
                      "Choose a supported local video path or use the file picker."}
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Reference profile</span>
                  <strong>{selectedDraftProfile.name}</strong>
                  <p>{selectedDraftProfile.description}</p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Session name</span>
                  <strong>{analysisTitlePreview}</strong>
                  <p>
                    {analysisTitle.trim()
                      ? "Using your custom name."
                      : "Using the file name by default."}
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
                  {isAnalyzing ? "Scanning video..." : "Scan video"}
                </button>
                <p className="analysis-support-copy">
                  HS will open a review queue as soon as the scan finishes.
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
                  <span className="detail-label">Ready to scan</span>
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

            {showStartGuide ? (
              <article className="utility-block analysis-onboarding-card">
                <div className="panel-header">
                  <div>
                    <span className="detail-label">{startGuide.statusLabel}</span>
                    <h2>{startGuide.headline}</h2>
                    <p>{startGuide.detail}</p>
                  </div>
                </div>
                <ol className="plain-list ordered analysis-step-list">
                  {startGuide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {startGuide.ctaLabel ? (
                  <div className="action-row">
                    <button
                      className="button-secondary"
                      onClick={() => {
                        if (startGuide.ctaAction === "references") {
                          setActivePage("profiles");
                          return;
                        }

                        if (startGuide.ctaAction === "pick-media") {
                          void handlePickMedia();
                        }
                      }}
                      type="button"
                    >
                      {startGuide.ctaLabel}
                    </button>
                  </div>
                ) : null}
              </article>
            ) : null}

            {isAnalyzing ? (
              <article className="analysis-readiness-card ready">
                <div className="analysis-readiness-header">
                  <div>
                    <span className="detail-label">Scan in progress</span>
                    <strong>HS is scanning this video locally</strong>
                    <p className="analysis-readiness-copy">
                      Large files can take a bit. Keep this window open and HS
                      will jump straight into Review when the scan finishes.
                    </p>
                  </div>
                  <span className="analysis-readiness-pill ready">Working</span>
                </div>
              </article>
            ) : null}

            <article className="utility-block">
              <span className="detail-label">What HS does next</span>
              <ol className="plain-list ordered">
                <li>HS scans the video locally.</li>
                <li>It builds a queue of likely moments worth checking.</li>
                <li>You jump straight into review and decide what is worth keeping.</li>
              </ol>
              {projectSession ? (
                <p>
                  Loaded session: {projectSession.title} •{" "}
                  {projectSession.candidates.length} moments •{" "}
                  {activeSessionReviewStateLabel ?? "Needs review"}
                </p>
              ) : (
                <p>No saved review session is open yet.</p>
              )}
            </article>
          </div>
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
        <details className="utility-block internal-details review-timeline-details">
          <summary className="internal-details-summary">
            <span>Video map</span>
            <span className="queue-count">Optional</span>
          </summary>
          <CandidateTimeline
            candidates={sessionCandidates}
            decisionsByCandidateId={decisionsByCandidateId}
            durationSeconds={projectSession?.mediaSource.durationSeconds ?? 0}
            onSelectCandidate={handleSelectCandidate}
            selectedCandidateId={selectedCandidate?.id ?? null}
          />
        </details>
        <div className="desktop-review-grid">
          <CandidateQueue
            bandFilter={bandFilter}
            candidates={queueCandidates}
            decisionsByCandidateId={decisionsByCandidateId}
            isStrongMatchFallback={isStrongMatchFallback}
            matchingCandidateCount={searchFilteredCandidates.length}
            onSelectNextPending={handleSelectNextPending}
            onBandFilterChange={setBandFilter}
            onPresentationModeChange={setPresentationMode}
            onPreviewCandidate={(candidateId) =>
              handleOpenMomentPreview(candidateId)
            }
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
            canPreview={Boolean(projectSession?.mediaSource.path)}
            decision={selectedDecision}
            exportPreview={timestampPreview}
            onPreviewDetectedMoment={() =>
              handleOpenMomentPreview(
                selectedCandidate?.id ?? null,
                "DETECTED_MOMENT",
              )
            }
            onPreviewSuggestedSegment={() =>
              handleOpenMomentPreview(selectedCandidate?.id ?? null)
            }
            profileMatchingSummary={profileMatchingSummary}
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
            jsonPreview={jsonPreview}
            reviewError={reviewError}
            visibleCandidateCount={queueCandidates.length}
          />
        </div>
      </section>
    );
  }

  function renderDesktopAside() {
    if (activePage === "new-analysis") {
      return (
        <div className="desktop-aside-stack">
          <article className="utility-block">
            <span className="detail-label">Before you scan</span>
            <p>Choose one local video file.</p>
            <p>Pick the profile that best matches what you want HS to favor.</p>
            <p>Give the session a name only if the file name is not enough.</p>
          </article>
          <article className="utility-block">
            <span className="detail-label">Why profiles matter</span>
            <p>
              Profiles give HS examples of the kinds of moments you usually keep.
            </p>
            <p>
              Reusable clips help with short moments. Indexed edits help with
              longer-form style and pacing.
            </p>
          </article>
        </div>
      );
    }

    if (activePage === "projects") {
      return (
        <div className="desktop-aside-stack">
          <article className="utility-block">
            <span className="detail-label">Backlog snapshot</span>
            <p>
              {projectSummaries.length} saved session
              {projectSummaries.length === 1 ? "" : "s"} total
            </p>
            <p>
              {pendingSessionCount} session
              {pendingSessionCount === 1 ? "" : "s"} still need review
            </p>
          </article>
          <article className="utility-block">
            <span className="detail-label">Next up</span>
            <p>
              {nextPendingSession
                ? `${nextPendingSession.sessionTitle} • ${nextPendingSession.pendingCount} undecided`
                : "Nothing is waiting right now."}
            </p>
          </article>
        </div>
      );
    }

    if (activePage === "profiles") {
      return (
        <div className="desktop-aside-stack">
          <article className="utility-block">
            <span className="detail-label">Start simple</span>
            <p>Create or choose one profile.</p>
            <p>Add an edited video if you want longform reference material.</p>
            <p>Add reusable clips only when they teach something specific.</p>
          </article>
          <article className="utility-block">
            <span className="detail-label">Optional tools</span>
            <p>
              VOD/edit audits and background job history are useful, but they are
              secondary to building a clean reference library.
            </p>
          </article>
        </div>
      );
    }

    return (
      <div className="desktop-aside-stack">
        <article className="utility-block">
          <span className="detail-label">Current video</span>
          <p>{selectedMediaPath || "No video selected yet."}</p>
          <p>
            {sessionCandidates.length} suggested moment
            {sessionCandidates.length === 1 ? "" : "s"} • {acceptedCount} kept
          </p>
          <p>
            {pendingReviewCount} undecided • {rejectedCount} skipped
          </p>
        </article>
        <article className="utility-block">
          <span className="detail-label">Keyboard shortcuts</span>
          <ul className="plain-list review-shortcut-list">
            <li>
              <strong>K</strong>
              <span>Keep the current moment</span>
            </li>
            <li>
              <strong>X</strong>
              <span>Skip the current moment</span>
            </li>
            <li>
              <strong>N</strong>
              <span>Jump to the next undecided moment</span>
            </li>
            <li>
              <strong>V</strong>
              <span>Open the selected moment in the video player</span>
            </li>
            <li>
              <strong>J / L</strong>
              <span>Move to the previous or next visible moment</span>
            </li>
            <li>
              <strong>[ / ]</strong>
              <span>Lengthen the clip start or ending by 2 seconds</span>
            </li>
            <li>
              <strong>/</strong>
              <span>Focus the queue search box</span>
            </li>
          </ul>
        </article>
        <TranscriptSnippetBlock
          heading="Current transcript focus"
          text={
            selectedCandidate?.transcriptSnippet ??
            "Select a moment to inspect its transcript context."
          }
        />
        {pendingReviewCount === 0 ? (
          <article className="utility-block">
            <span className="detail-label">Export</span>
            <p>Export actions are available in the session completion card.</p>
          </article>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <LayoutShell
        activeId={activePage}
        appName="HighlightSmith"
        aside={renderDesktopAside()}
        navItems={desktopPages}
        onSelect={(pageId) => setActivePage(pageId as DesktopPage)}
        subtitle="Scan long videos, review likely moments quickly, and build references from your own edits."
        title="Creator Workspace"
      >
        <ShellHeader
          activeSessionStateLabel={
            activeSessionReviewStateLabel
              ? activeSessionReviewStateLabel
              : normalizedSelectedMediaPath
                ? "Video staged for scanning"
                : "Choose a video or reopen a saved session."
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
          selectedMediaPath={selectedMediaPath || "No video selected yet."}
          themeMode={themeMode}
          totalCount={sessionCandidates.length}
        />
        {renderDesktopPage()}
        <MomentPreviewModal
          apiBaseUrl={apiBaseUrl}
          candidate={previewCandidate}
          decision={previewDecision}
          initialMode={momentPreviewState?.mode ?? "SUGGESTED_SEGMENT"}
          isOpen={activePage === "candidate-review" && previewCandidate !== null}
          mediaDurationSeconds={projectSession?.mediaSource.durationSeconds ?? 0}
          mediaPath={projectSession?.mediaSource.path ?? selectedMediaPath}
          onClose={handleCloseMomentPreview}
        />
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
      detail: "Waiting for your saved profiles.",
      headline: "Loading reference profiles",
      statusLabel: "Loading",
      tone: "blocked",
    };
  }

  if (!options.hasPersistedProfiles) {
    return {
      canAnalyze: false,
      detail: "Create a profile first so HS has some idea what to favor.",
      headline: "No reference profile yet",
      statusLabel: "Add profile",
      tone: "blocked",
    };
  }

  if (!sourcePath) {
    return {
      canAnalyze: false,
      detail: "Choose a supported local video before starting.",
      headline: "Choose a video",
      statusLabel: "Add video",
      tone: "blocked",
    };
  }

  if (!isSupportedInput(sourcePath)) {
    return {
      canAnalyze: false,
      detail: `Unsupported media extension. Use one of: ${supportedInputExtensions.join(", ")}`,
      headline: "Unsupported file type",
      statusLabel: "Fix input",
      tone: "blocked",
    };
  }

  return {
    canAnalyze: true,
    detail: "HS can scan this video now and open a review queue when it finishes.",
    headline: "Ready to scan",
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
    "Unable to load background activity.",
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
        : "Background activity could not be loaded",
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
    "Unable to start background analysis.",
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
        : "Background analysis could not be started",
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
    "Unable to cancel background analysis.",
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
        : "Background analysis could not be cancelled",
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
    "Unable to load saved sessions.",
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
    return "Open session";
  }

  if (sessionReviewState === "IN_PROGRESS") {
    return "Continue review";
  }

  return "Start reviewing";
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
        "This profile is missing locally. Refresh the saved profile library.",
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

function buildStartGuide(input: {
  hasPersistedProfiles: boolean;
  hasReferenceMaterial: boolean;
  hasSavedSessions: boolean;
  hasSelectedVideo: boolean;
}): StartGuide {
  if (!input.hasPersistedProfiles) {
    return {
      statusLabel: "First setup",
      headline: "Create your first profile",
      detail:
        "Profiles give HS a starting point for the kinds of moments you usually keep.",
      steps: [
        "Open References and create one profile.",
        "Add a couple of reusable clips or one finished edit.",
        "Come back here to scan a video into review.",
      ],
      ctaLabel: "Open References",
      ctaAction: "references",
    };
  }

  if (!input.hasReferenceMaterial) {
    return {
      statusLabel: input.hasSavedSessions ? "Reference refresh" : "First setup",
      headline: "Add a few examples before the first serious scan",
      detail:
        "HS gets more useful once it can lean on a small library of clips or one finished edit.",
      steps: [
        "Add 2-3 reusable clips that feel representative.",
        "Add one finished edited video if you have one.",
        "Then scan a longer video and review the moments HS suggests.",
      ],
      ctaLabel: "Add references",
      ctaAction: "references",
    };
  }

  if (!input.hasSelectedVideo) {
    return {
      statusLabel: input.hasSavedSessions ? "Next scan" : "Ready",
      headline: input.hasSavedSessions
        ? "Choose the next video to scan"
        : "Pick the first video you want to scan",
      detail:
        "Once you choose a local file, HS can build a review queue and open the results directly into Review.",
      steps: [
        "Choose one local video file.",
        "Confirm the reference profile you want HS to lean on.",
        "Start the scan and go straight into review.",
      ],
      ctaLabel: "Choose video",
      ctaAction: "pick-media",
    };
  }

  return {
    statusLabel: input.hasSavedSessions ? "Ready" : "First scan",
    headline: input.hasSavedSessions
      ? "This scan is ready to run"
      : "You are ready for the first scan",
    detail:
      "Start with one video, let HS build the review queue, then make keep or skip decisions in Review.",
    steps: [
      "Run the scan from the main action on the left.",
      "Check the first few suggested moments in Review.",
      "Keep building references as you learn what HS should favor.",
    ],
    ctaLabel: null,
    ctaAction: null,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}
