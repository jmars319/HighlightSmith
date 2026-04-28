import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { supportedInputExtensions } from "@highlightsmith/media";
import type {
  AddExampleClipRequest,
  CancelMediaAlignmentJobRequest,
  ClipProfile,
  CancelMediaIndexJobRequest,
  CreateClipProfileRequest,
  CreateMediaAlignmentJobRequest,
  CreateMediaEditPairRequest,
  CreateMediaIndexJobRequest,
  CreateMediaLibraryAssetRequest,
  ExampleClip,
  ExampleReferenceKind,
  ExampleClipSourceType,
  MediaAlignmentJob,
  MediaAlignmentMatch,
  MediaEditPair,
  MediaIndexJob,
  MediaLibraryAsset,
  MediaLibraryAssetScope,
  MediaLibraryAssetType,
  ReplaceMediaThumbnailOutputsRequest,
} from "@highlightsmith/shared-types";

type ProfileWorkspaceProps = {
  profiles: ClipProfile[];
  selectedProfileId: string | null;
  selectedProfile: ClipProfile | null;
  examples: ExampleClip[];
  libraryAssets: MediaLibraryAsset[];
  mediaIndexJobs: MediaIndexJob[];
  mediaAlignmentJobs: MediaAlignmentJob[];
  mediaAlignmentMatches: MediaAlignmentMatch[];
  mediaEditPairs: MediaEditPair[];
  cancellingMediaIndexJobIds: Record<string, boolean>;
  cancellingMediaAlignmentJobIds: Record<string, boolean>;
  savingThumbnailOutputAssetIds: Record<string, boolean>;
  isLoadingProfiles: boolean;
  isLoadingExamples: boolean;
  isLoadingLibraryAssets: boolean;
  isLoadingMediaIndexJobs: boolean;
  isLoadingMediaAlignmentJobs: boolean;
  isLoadingMediaPairs: boolean;
  isCreatingProfile: boolean;
  isAddingExample: boolean;
  isCreatingMediaAsset: boolean;
  isCreatingMediaIndexJob: boolean;
  isCreatingMediaAlignmentJob: boolean;
  isCreatingMediaPair: boolean;
  error: string | null;
  onSelectProfile: (profileId: string) => void;
  onCreateProfile: (input: CreateClipProfileRequest) => Promise<void>;
  onAddExample: (
    profileId: string,
    input: AddExampleClipRequest,
  ) => Promise<void>;
  onCreateMediaAsset: (
    input: CreateMediaLibraryAssetRequest,
  ) => Promise<void>;
  onCreateMediaIndexJob: (
    input: CreateMediaIndexJobRequest,
  ) => Promise<void>;
  onReplaceThumbnailOutputs: (
    assetId: string,
    input: ReplaceMediaThumbnailOutputsRequest,
  ) => Promise<void>;
  onCreateMediaAlignmentJob: (
    input: CreateMediaAlignmentJobRequest,
  ) => Promise<void>;
  onCancelMediaIndexJob: (
    input: CancelMediaIndexJobRequest,
  ) => Promise<void>;
  onCancelMediaAlignmentJob: (
    input: CancelMediaAlignmentJobRequest,
  ) => Promise<void>;
  onCreateMediaPair: (input: CreateMediaEditPairRequest) => Promise<void>;
};

const sourceTypeOptions: Array<{
  id: ExampleClipSourceType;
  label: string;
  hint: string;
}> = [
  {
    id: "TWITCH_CLIP_URL",
    label: "Twitch clip URL",
    hint: "Paste a clip link and keep it as a saved reference for future retrieval.",
  },
  {
    id: "YOUTUBE_SHORT_URL",
    label: "YouTube Short URL",
    hint: "Store the Short link now. Retrieval and feature extraction come later.",
  },
  {
    id: "LOCAL_FILE_UPLOAD",
    label: "Local clip file",
    hint: "Choose a clip from disk with the desktop file picker.",
  },
  {
    id: "LOCAL_FILE_PATH",
    label: "Local clip path",
    hint: "Paste or type an already-known local clip path.",
  },
];

const localOnlySourceTypeOptions = sourceTypeOptions.filter((option) =>
  option.id === "LOCAL_FILE_UPLOAD" || option.id === "LOCAL_FILE_PATH",
);

export function ProfileWorkspace({
  profiles,
  selectedProfileId,
  selectedProfile,
  examples,
  libraryAssets,
  mediaIndexJobs,
  mediaAlignmentJobs,
  mediaAlignmentMatches,
  mediaEditPairs,
  cancellingMediaIndexJobIds,
  cancellingMediaAlignmentJobIds,
  savingThumbnailOutputAssetIds,
  isLoadingProfiles,
  isLoadingExamples,
  isLoadingLibraryAssets,
  isLoadingMediaIndexJobs,
  isLoadingMediaAlignmentJobs,
  isLoadingMediaPairs,
  isCreatingProfile,
  isAddingExample,
  isCreatingMediaAsset,
  isCreatingMediaIndexJob,
  isCreatingMediaAlignmentJob,
  isCreatingMediaPair,
  error,
  onSelectProfile,
  onCreateProfile,
  onAddExample,
  onCreateMediaAsset,
  onCreateMediaIndexJob,
  onReplaceThumbnailOutputs,
  onCreateMediaAlignmentJob,
  onCancelMediaIndexJob,
  onCancelMediaAlignmentJob,
  onCreateMediaPair,
}: ProfileWorkspaceProps) {
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [sourceType, setSourceType] =
    useState<ExampleClipSourceType>("TWITCH_CLIP_URL");
  const [sourceValue, setSourceValue] = useState("");
  const [exampleTitle, setExampleTitle] = useState("");
  const [exampleNote, setExampleNote] = useState("");
  const [profileEditSourceType, setProfileEditSourceType] =
    useState<ExampleClipSourceType>("LOCAL_FILE_PATH");
  const [profileEditSourceValue, setProfileEditSourceValue] = useState("");
  const [profileEditTitle, setProfileEditTitle] = useState("");
  const [profileEditNote, setProfileEditNote] = useState("");
  const [assetType, setAssetType] = useState<MediaLibraryAssetType>("CLIP");
  const [assetScope, setAssetScope] = useState<MediaLibraryAssetScope>("GLOBAL");
  const [assetSourceType, setAssetSourceType] =
    useState<ExampleClipSourceType>("LOCAL_FILE_PATH");
  const [assetSourceValue, setAssetSourceValue] = useState("");
  const [assetTitle, setAssetTitle] = useState("");
  const [assetNote, setAssetNote] = useState("");
  const [pairScope, setPairScope] = useState<MediaLibraryAssetScope>("GLOBAL");
  const [selectedVodAssetId, setSelectedVodAssetId] = useState("");
  const [selectedEditAssetId, setSelectedEditAssetId] = useState("");
  const [pairTitle, setPairTitle] = useState("");
  const [pairNote, setPairNote] = useState("");

  const visibleExamples =
    examples.length > 0 || isLoadingExamples
      ? examples
      : (selectedProfile?.exampleClips ?? []);
  const selectedSourceType = sourceTypeOptions.find(
    (option) => option.id === sourceType,
  );
  const usesLocalFilePicker =
    sourceType === "LOCAL_FILE_UPLOAD" || sourceType === "LOCAL_FILE_PATH";
  const usesLocalProfileEditPicker =
    profileEditSourceType === "LOCAL_FILE_UPLOAD" ||
    profileEditSourceType === "LOCAL_FILE_PATH";
  const availableAssetSourceTypes =
    assetType === "CLIP" ? sourceTypeOptions : localOnlySourceTypeOptions;
  const selectedAssetSourceType = availableAssetSourceTypes.find(
    (option) => option.id === assetSourceType,
  );
  const usesLocalAssetPicker =
    assetSourceType === "LOCAL_FILE_UPLOAD" ||
    assetSourceType === "LOCAL_FILE_PATH";
  const globalClipCount = libraryAssets.filter(
    (asset) => asset.assetType === "CLIP" && asset.scope === "GLOBAL",
  ).length;
  const vodAssetOptions = libraryAssets.filter((asset) => asset.assetType === "VOD");
  const editAssetOptions = libraryAssets.filter(
    (asset) => asset.assetType === "EDIT",
  );
  const selectedProfileReferenceCount = selectedProfile?.exampleClips.length ?? 0;
  const selectedProfileEditReferenceCount =
    selectedProfile?.exampleClips.filter(
      (example) => example.referenceKind === "PROFILE_EDIT",
    ).length ?? 0;
  const selectedProfileClipReferenceCount =
    selectedProfileReferenceCount - selectedProfileEditReferenceCount;
  const selectedProfileUsableReferenceCount =
    selectedProfile?.exampleClips.filter((example) => example.featureSummary)
      .length ?? 0;
  const latestIndexJobByAssetId = new Map<string, MediaIndexJob>();
  for (const job of mediaIndexJobs) {
    if (!latestIndexJobByAssetId.has(job.assetId)) {
      latestIndexJobByAssetId.set(job.assetId, job);
    }
  }
  const latestAlignmentJobByPairId = new Map<string, MediaAlignmentJob>();
  for (const job of mediaAlignmentJobs) {
    if (job.pairId && !latestAlignmentJobByPairId.has(job.pairId)) {
      latestAlignmentJobByPairId.set(job.pairId, job);
    }
  }
  const mediaAssetById = new Map<string, MediaLibraryAsset>();
  for (const asset of libraryAssets) {
    mediaAssetById.set(asset.id, asset);
  }
  const mediaEditPairById = new Map<string, MediaEditPair>();
  for (const pair of mediaEditPairs) {
    mediaEditPairById.set(pair.id, pair);
  }
  const activeIndexJobCount = mediaIndexJobs.filter(
    (job) => job.status === "QUEUED" || job.status === "RUNNING",
  ).length;
  const activeAlignmentJobCount = mediaAlignmentJobs.filter(
    (job) => job.status === "QUEUED" || job.status === "RUNNING",
  ).length;
  const recentBackgroundActivity = [
    ...mediaIndexJobs.map((job) => ({
      kind: "INDEX" as const,
      updatedAt: parseTimestamp(job.updatedAt),
      job,
    })),
    ...mediaAlignmentJobs.map((job) => ({
      kind: "ALIGNMENT" as const,
      updatedAt: parseTimestamp(job.updatedAt),
      job,
    })),
  ].sort((left, right) => right.updatedAt - left.updatedAt);

  async function openLocalMediaPicker(
    nextSourceType: ExampleClipSourceType,
    onSelect: (selection: string) => void,
  ) {
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

      if (typeof selection === "string") {
        onSelect(selection);
      }
    } catch {
      if (nextSourceType === "LOCAL_FILE_UPLOAD") {
        onSelect("");
      }
    }
  }

  async function handlePickLocalExample(nextSourceType: ExampleClipSourceType) {
    setSourceType(nextSourceType);
    await openLocalMediaPicker(nextSourceType, (selection) =>
      setSourceValue(selection),
    );
  }

  async function handlePickProfileEdit(nextSourceType: ExampleClipSourceType) {
    setProfileEditSourceType(nextSourceType);
    await openLocalMediaPicker(nextSourceType, (selection) =>
      setProfileEditSourceValue(selection),
    );
  }

  async function handlePickMediaLibraryAsset(
    nextSourceType: ExampleClipSourceType,
  ) {
    setAssetSourceType(nextSourceType);
    await openLocalMediaPicker(nextSourceType, (selection) =>
      setAssetSourceValue(selection),
    );
  }

  async function handleCreateProfile() {
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      await onCreateProfile({
        name: trimmedName,
        description: profileDescription.trim() || undefined,
      });
      setProfileName("");
      setProfileDescription("");
    } catch {
      return;
    }
  }

  async function handleAddExample() {
    if (!selectedProfileId || !sourceValue.trim()) {
      return;
    }

    try {
      await onAddExample(selectedProfileId, {
        sourceType,
        sourceValue: sourceValue.trim(),
        title: exampleTitle.trim() || undefined,
        note: exampleNote.trim() || undefined,
      });
      setSourceValue("");
      setExampleTitle("");
      setExampleNote("");
    } catch {
      return;
    }
  }

  async function handleCreateProfileEdit() {
    if (!selectedProfileId || !profileEditSourceValue.trim()) {
      return;
    }

    try {
      await onCreateMediaAsset({
        assetType: "EDIT",
        scope: "PROFILE",
        profileId: selectedProfileId,
        sourceType: profileEditSourceType,
        sourceValue: profileEditSourceValue.trim(),
        title: profileEditTitle.trim() || undefined,
        note: profileEditNote.trim() || undefined,
      });
      setProfileEditSourceValue("");
      setProfileEditTitle("");
      setProfileEditNote("");
      setProfileEditSourceType("LOCAL_FILE_PATH");
    } catch {
      return;
    }
  }

  async function handleCreateMediaAsset() {
    if (!assetSourceValue.trim()) {
      return;
    }

    if (assetScope === "PROFILE" && !selectedProfileId) {
      return;
    }

    try {
      await onCreateMediaAsset({
        assetType,
        scope: assetScope,
        profileId: assetScope === "PROFILE" ? selectedProfileId ?? undefined : undefined,
        sourceType: assetSourceType,
        sourceValue: assetSourceValue.trim(),
        title: assetTitle.trim() || undefined,
        note: assetNote.trim() || undefined,
      });
      setAssetSourceValue("");
      setAssetTitle("");
      setAssetNote("");
      if (assetType !== "CLIP") {
        setAssetSourceType("LOCAL_FILE_PATH");
      }
    } catch {
      return;
    }
  }

  async function handleCreateMediaPair() {
    if (!selectedVodAssetId || !selectedEditAssetId) {
      return;
    }

    if (pairScope === "PROFILE" && !selectedProfileId) {
      return;
    }

    try {
      await onCreateMediaPair({
        vodAssetId: selectedVodAssetId,
        editAssetId: selectedEditAssetId,
        profileId: pairScope === "PROFILE" ? selectedProfileId ?? undefined : undefined,
        title: pairTitle.trim() || undefined,
        note: pairNote.trim() || undefined,
      });
      setSelectedVodAssetId("");
      setSelectedEditAssetId("");
      setPairTitle("");
      setPairNote("");
    } catch {
      return;
    }
  }

  return (
    <section className="profile-library-layout">
      <div className="profile-sidebar-stack">
        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Clip profiles</span>
              <h2>Reference-driven profile library</h2>
              <p>
                Save creator profiles here. Local clips and analyzed profile
                edits become reusable references for future scans.
              </p>
            </div>
            <span className="queue-count">{profiles.length} profiles</span>
          </div>

          {isLoadingProfiles ? (
            <p className="queue-summary-copy">Loading local profiles...</p>
          ) : null}

          <div className="profile-card-list">
            {profiles.map((profile) => {
              const isActive = profile.id === selectedProfileId;
              return (
                <button
                  className={
                    isActive ? "profile-list-card active" : "profile-list-card"
                  }
                  key={profile.id}
                  onClick={() => onSelectProfile(profile.id)}
                  type="button"
                >
                  <div className="profile-list-card-top">
                    <span className="detail-label">
                      {profile.source === "SYSTEM"
                        ? "System profile"
                        : "User profile"}
                    </span>
                    <span className="session-state-pill active-session">
                      {profile.exampleClips.length} references
                    </span>
                  </div>
                  <strong>{profile.name}</strong>
                  <p>{profile.description || "No description yet."}</p>
                </button>
              );
            })}
          </div>
        </article>

        <article className="utility-block">
          <span className="detail-label">Create profile</span>
          <div className="analysis-form">
            <label className="search-block">
              <span className="input-label">Name</span>
              <input
                className="search-input"
                disabled={isCreatingProfile}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Dry humor"
                type="text"
                value={profileName}
              />
            </label>

            <label className="search-block">
              <span className="input-label">Description</span>
              <textarea
                className="search-input profile-textarea"
                disabled={isCreatingProfile}
                onChange={(event) => setProfileDescription(event.target.value)}
                placeholder="Describe the kind of moments this profile should eventually prefer."
                value={profileDescription}
              />
            </label>

            <div className="action-row">
              <button
                className="button-primary"
                disabled={isCreatingProfile || !profileName.trim()}
                onClick={() => {
                  void handleCreateProfile();
                }}
                type="button"
              >
                {isCreatingProfile ? "Creating profile..." : "Create profile"}
              </button>
            </div>
          </div>
        </article>
      </div>

      <div className="profile-detail-stack">
        <article className="utility-block">
          {selectedProfile ? (
            <>
              <div className="panel-header">
                <div>
                  <span className="detail-label">Selected profile</span>
                  <h2>{selectedProfile.name}</h2>
                  <p>
                    {selectedProfile.description ||
                      "No description yet. Add context, reusable clips, or an analyzed edit to make this profile more useful."}
                  </p>
                </div>
                <div className="profile-summary-badges">
                  <span className="session-state-pill active-session">
                    {selectedProfile.state}
                  </span>
                  <span className="session-state-pill next-target">
                    {selectedProfile.source === "SYSTEM" ? "System" : "User"}
                  </span>
                </div>
              </div>

              <div className="analysis-summary-grid analysis-summary-grid-compact">
                <article className="analysis-summary-card">
                  <span className="detail-label">Saved references</span>
                  <strong>{selectedProfileReferenceCount} total</strong>
                  <p>
                    Reusable clips stay shortform. Profile-scoped edits become
                    longform references after analysis.
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Reference mix</span>
                  <strong>
                    {selectedProfileClipReferenceCount} clips •{" "}
                    {selectedProfileEditReferenceCount} edits
                  </strong>
                  <p>
                    Clips capture reusable moments. Analyzed edits show what
                    survived a real editorial pass.
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Match readiness</span>
                  <strong>
                    {selectedProfileUsableReferenceCount} ready local references
                  </strong>
                  <p>
                    Only local material participates today. Analyzed profile
                    edits and local clips both feed local matching.
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Last updated</span>
                  <strong>{formatTimestamp(selectedProfile.updatedAt)}</strong>
                  <p>Created {formatTimestamp(selectedProfile.createdAt)}</p>
                </article>
              </div>
            </>
          ) : (
            <>
              <span className="detail-label">Selected profile</span>
              <h2>No profile selected</h2>
              <p>
                Create a profile or choose one from the library to start adding
                reference sources.
              </p>
            </>
          )}
        </article>

        {error ? <p className="analysis-error">{error}</p> : null}

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Start here</span>
              <h2>Build this profile with real examples</h2>
              <p>
                The simplest path is clips first, then one edited video, then
                advanced library tools only if you need them.
              </p>
            </div>
          </div>

          {selectedProfile ? (
            <ol className="plain-list ordered reference-step-list">
              <li>Add a few short clips that capture the kinds of moments you want more of.</li>
              <li>Add one finished edited video so HS can learn what survives a real cut.</li>
              <li>Use the media lab later for VOD libraries, background analysis, or VOD/edit comparisons.</li>
            </ol>
          ) : (
            <p className="queue-summary-copy">
              Choose or create a profile first. Then add clips and edited videos
              as references.
            </p>
          )}
        </article>

        <div className="reference-primary-grid">
          <article className="utility-block">
            <div className="panel-header">
              <div>
                <span className="detail-label">Add reusable clip</span>
                <h2>Add reusable clips</h2>
                <p>
                  Use clips for short reusable moments you want HS to find
                  again.
                </p>
              </div>
            </div>

            <div className="analysis-form">
              <label className="search-block">
                <span className="input-label">Source type</span>
                <select
                  className="search-input"
                  disabled={!selectedProfile || isAddingExample}
                  onChange={(event) =>
                    setSourceType(event.target.value as ExampleClipSourceType)
                  }
                  value={sourceType}
                >
                  {sourceTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="analysis-field-note">
                  {selectedSourceType?.hint}
                </small>
              </label>

              <label className="search-block">
                <span className="input-label">
                  {sourceType === "LOCAL_FILE_PATH" ||
                  sourceType === "LOCAL_FILE_UPLOAD"
                    ? "Local path or file"
                    : "Source URL"}
                </span>
                <input
                  className="search-input"
                  disabled={!selectedProfile || isAddingExample}
                  onChange={(event) => setSourceValue(event.target.value)}
                  placeholder={
                    sourceType === "TWITCH_CLIP_URL"
                      ? "https://clips.twitch.tv/..."
                      : sourceType === "YOUTUBE_SHORT_URL"
                        ? "https://www.youtube.com/shorts/..."
                        : "/Users/you/Clips/example.mp4"
                  }
                  type="text"
                  value={sourceValue}
                />
              </label>

              {usesLocalFilePicker ? (
                <div className="action-row">
                  <button
                    className="button-secondary"
                    disabled={!selectedProfile || isAddingExample}
                    onClick={() => {
                      void handlePickLocalExample(sourceType);
                    }}
                    type="button"
                  >
                    Choose local clip
                  </button>
                </div>
              ) : null}

              <div className="analysis-inline-grid">
                <label className="search-block">
                  <span className="input-label">Optional title</span>
                  <input
                    className="search-input"
                    disabled={!selectedProfile || isAddingExample}
                    onChange={(event) => setExampleTitle(event.target.value)}
                    placeholder="Dry payoff example"
                    type="text"
                    value={exampleTitle}
                  />
                </label>

                <label className="search-block">
                  <span className="input-label">Optional rationale</span>
                  <input
                    className="search-input"
                    disabled={!selectedProfile || isAddingExample}
                    onChange={(event) => setExampleNote(event.target.value)}
                    placeholder="Why this example matters"
                    type="text"
                    value={exampleNote}
                  />
                </label>
              </div>

              <div className="action-row">
                <button
                  className="button-primary"
                  disabled={
                    !selectedProfile || isAddingExample || !sourceValue.trim()
                  }
                  onClick={() => {
                    void handleAddExample();
                  }}
                  type="button"
                >
                  {isAddingExample
                    ? "Saving example..."
                    : "Add clip reference"}
                </button>
              </div>
            </div>
          </article>

          <article className="utility-block">
            <div className="panel-header">
              <div>
                <span className="detail-label">Add edited video</span>
                <h2>Add one finished edit</h2>
                <p>
                  Use a finished edited video to show HS what actually survived
                  your longform editorial pass.
                </p>
              </div>
            </div>

            <div className="analysis-form">
              <label className="search-block">
                <span className="input-label">Source type</span>
                <select
                  className="search-input"
                  disabled={!selectedProfile || isCreatingMediaAsset}
                  onChange={(event) =>
                    setProfileEditSourceType(
                      event.target.value as ExampleClipSourceType,
                    )
                  }
                  value={profileEditSourceType}
                >
                  {localOnlySourceTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="analysis-field-note">
                  Choose a local file or paste a local path for the finished
                  edit you want HS to study.
                </small>
              </label>

              <label className="search-block">
                <span className="input-label">Local path or file</span>
                <input
                  className="search-input"
                  disabled={!selectedProfile || isCreatingMediaAsset}
                  onChange={(event) =>
                    setProfileEditSourceValue(event.target.value)
                  }
                  placeholder="/Users/you/Exports/session-edit.mp4"
                  type="text"
                  value={profileEditSourceValue}
                />
              </label>

              {usesLocalProfileEditPicker ? (
                <div className="action-row">
                  <button
                    className="button-secondary"
                    disabled={!selectedProfile || isCreatingMediaAsset}
                    onClick={() => {
                      void handlePickProfileEdit(profileEditSourceType);
                    }}
                    type="button"
                  >
                    Choose edited video
                  </button>
                </div>
              ) : null}

              <div className="analysis-inline-grid">
                <label className="search-block">
                  <span className="input-label">Optional title</span>
                  <input
                    className="search-input"
                    disabled={!selectedProfile || isCreatingMediaAsset}
                    onChange={(event) => setProfileEditTitle(event.target.value)}
                    placeholder="March 12 final cut"
                    type="text"
                    value={profileEditTitle}
                  />
                </label>

                <label className="search-block">
                  <span className="input-label">Optional note</span>
                  <input
                    className="search-input"
                    disabled={!selectedProfile || isCreatingMediaAsset}
                    onChange={(event) => setProfileEditNote(event.target.value)}
                    placeholder="What this edit teaches HS"
                    type="text"
                    value={profileEditNote}
                  />
                </label>
              </div>

              <div className="action-row">
                <button
                  className="button-primary"
                  disabled={
                    !selectedProfile ||
                    isCreatingMediaAsset ||
                    !profileEditSourceValue.trim()
                  }
                  onClick={() => {
                    void handleCreateProfileEdit();
                  }}
                  type="button"
                >
                  {isCreatingMediaAsset
                    ? "Saving edit..."
                    : "Add edited video reference"}
                </button>
              </div>
            </div>
          </article>
        </div>

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Profile references</span>
              <h2>What this profile already knows</h2>
            </div>
            {isLoadingExamples ? (
              <span className="queue-count">Refreshing…</span>
            ) : null}
          </div>

          {selectedProfile && visibleExamples.length === 0 ? (
            <p className="queue-summary-copy">
              No saved reference sources yet for this profile.
            </p>
          ) : null}

          <div className="profile-example-list">
            {visibleExamples.map((example) => (
              <article className="profile-example-card" key={example.id}>
                <div className="profile-example-top">
                  <span className="detail-label">
                    {formatReferenceKind(
                      example.referenceKind,
                      example.sourceType,
                    )}
                  </span>
                  <span className="session-state-pill active-session">
                    {formatStatus(example.status)}
                  </span>
                </div>
                <strong>{example.title || "Untitled profile reference"}</strong>
                <p className="profile-example-source">{example.sourceValue}</p>
                {example.note ? <p>{example.note}</p> : null}
                {example.statusDetail ? (
                  <p className="queue-summary-copy">{example.statusDetail}</p>
                ) : null}
                {example.featureSummary ? (
                  <p className="queue-summary-copy">
                    {formatReferenceSummaryLabel(example.referenceKind)} • duration{" "}
                    {Math.round(example.featureSummary.durationSeconds)}s
                    {example.featureSummary.transcriptAnchorTerms.length > 0
                      ? ` • anchors ${formatTranscriptAnchors(example.featureSummary.transcriptAnchorTerms)}`
                      : ""}{" "}
                    • top signals{" "}
                    {formatTopReasons(example.featureSummary.topReasonCodes)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <details className="utility-block internal-details">
          <summary className="internal-details-summary">
            <span>Media lab</span>
            <span className="queue-count">Optional</span>
          </summary>

          <div className="advanced-tools-stack">
            {activeIndexJobCount > 0 || activeAlignmentJobCount > 0 ? (
              <article className="utility-block advanced-activity-banner">
                <div className="panel-header">
                  <div>
                    <span className="detail-label">Background work</span>
                    <h2>HS is still working in the background</h2>
                    <p>
                      {describeBackgroundActivity(
                        activeIndexJobCount,
                        activeAlignmentJobCount,
                      )} You can keep adding references while this finishes.
                    </p>
                  </div>
                  <span className="session-state-pill next-target">
                    In progress
                  </span>
                </div>
              </article>
            ) : null}

            <details
              className="utility-block internal-details advanced-lab-section"
              open={activeIndexJobCount > 0 || activeAlignmentJobCount > 0}
            >
              <summary className="internal-details-summary">
                <span>Background work</span>
                <span className="queue-count">
                  {isLoadingMediaIndexJobs || isLoadingMediaAlignmentJobs
                    ? "Refreshing…"
                    : `${recentBackgroundActivity.length} jobs`}
                </span>
              </summary>

            <article className="utility-block">
              <div className="panel-header">
                <div>
                  <span className="detail-label">Background activity</span>
                  <h2>Recent background work</h2>
                </div>
                <span className="queue-count">
                  {isLoadingMediaIndexJobs || isLoadingMediaAlignmentJobs
                    ? "Refreshing…"
                    : `${recentBackgroundActivity.length} jobs`}
                </span>
              </div>

              {recentBackgroundActivity.length === 0 ? (
                <p className="queue-summary-copy">
                  No background jobs have been started yet.
                </p>
              ) : null}

              <div className="profile-example-list">
                {recentBackgroundActivity.slice(0, 6).map((item) => {
                  if (item.kind === "INDEX") {
                    const asset = mediaAssetById.get(item.job.assetId);
                    return (
                      <article className="profile-example-card" key={item.job.id}>
                        <div className="profile-example-top">
                          <span className="detail-label">
                            {asset ? `${formatAssetType(asset.assetType)} analysis` : "Asset analysis"}
                          </span>
                          <span className="session-state-pill active-session">
                            {formatIndexJobStatus(item.job.status)}
                          </span>
                        </div>
                        <strong>
                          {asset?.title || asset?.sourceValue || item.job.assetId}
                        </strong>
                        <p className="queue-summary-copy">
                          {Math.round(item.job.progress * 100)}% • {item.job.statusDetail}
                        </p>
                        {item.job.result ? (
                          <p className="queue-summary-copy">
                            Result • {formatIndexSummary(item.job.result)}
                          </p>
                        ) : null}
                        {item.job.errorMessage ? (
                          <p className="analysis-error">{item.job.errorMessage}</p>
                        ) : null}
                      </article>
                    );
                  }

                  const pair = item.job.pairId
                    ? mediaEditPairById.get(item.job.pairId)
                    : undefined;
                  const sourceAsset = mediaAssetById.get(item.job.sourceAssetId);
                  const queryAsset = mediaAssetById.get(item.job.queryAssetId);
                  return (
                    <article className="profile-example-card" key={item.job.id}>
                      <div className="profile-example-top">
                        <span className="detail-label">VOD/edit comparison</span>
                        <span className="session-state-pill active-session">
                          {formatAlignmentJobStatus(item.job.status)}
                        </span>
                      </div>
                      <strong>
                        {pair?.title ||
                          `${sourceAsset?.title || sourceAsset?.sourceValue || item.job.sourceAssetId} -> ${queryAsset?.title || queryAsset?.sourceValue || item.job.queryAssetId}`}
                      </strong>
                      <p className="queue-summary-copy">
                        {Math.round(item.job.progress * 100)}% • {item.job.statusDetail}
                      </p>
                      <p className="queue-summary-copy">
                        {item.job.matchCount} candidate match
                        {item.job.matchCount === 1 ? "" : "es"} • method{" "}
                        {formatAlignmentMethod(item.job.method)}
                      </p>
                      {item.job.errorMessage ? (
                        <p className="analysis-error">{item.job.errorMessage}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </article>
            </details>

            <details className="utility-block internal-details advanced-lab-section">
              <summary className="internal-details-summary">
                <span>Full media library</span>
                <span className="queue-count">
                  {isLoadingLibraryAssets ? "Refreshing…" : `${libraryAssets.length} saved`}
                </span>
              </summary>

            <article className="utility-block">
              <div className="panel-header">
                <div>
                  <span className="detail-label">Media library</span>
                  <h2>VODs, edits, and reusable clips</h2>
                  <p>
                    Use this area when you need the full local library, not
                    just profile references.
                  </p>
                </div>
              </div>

              <div className="analysis-summary-grid analysis-summary-grid-compact">
                <article className="analysis-summary-card">
                  <span className="detail-label">Assets</span>
                  <strong>{libraryAssets.length}</strong>
                  <p>
                    {globalClipCount} global clip
                    {globalClipCount === 1 ? "" : "s"} •{" "}
                    {vodAssetOptions.length} VOD
                    {vodAssetOptions.length === 1 ? "" : "s"} •{" "}
                    {editAssetOptions.length} edit
                    {editAssetOptions.length === 1 ? "" : "s"}
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">VOD/edit comparisons</span>
                  <strong>{mediaEditPairs.length}</strong>
                  <p>
                    Optional VOD/edit audits that preserve keep/remove outcomes
                    and help surface missed moments.
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Scope</span>
                  <strong>{selectedProfile ? selectedProfile.name : "Global only"}</strong>
                  <p>
                    Profile scope keeps references tied to the current profile.
                    Global scope keeps them reusable across the whole library.
                  </p>
                </article>
              </div>
            </article>

            <article className="utility-block">
              <div className="panel-header">
                <div>
                  <span className="detail-label">Add media</span>
                  <h2>Add a clip, edit, or VOD</h2>
                  <p>
                    Register any local media asset here when you need the full
                    library workflow instead of the quick profile flow.
                  </p>
                </div>
              </div>

              <div className="analysis-form">
                <div className="analysis-inline-grid">
                  <label className="search-block">
                    <span className="input-label">Asset type</span>
                    <select
                      className="search-input"
                      disabled={isCreatingMediaAsset}
                      onChange={(event) => {
                        const nextAssetType = event.target
                          .value as MediaLibraryAssetType;
                        setAssetType(nextAssetType);
                        if (
                          nextAssetType !== "CLIP" &&
                          assetSourceType !== "LOCAL_FILE_PATH" &&
                          assetSourceType !== "LOCAL_FILE_UPLOAD"
                        ) {
                          setAssetSourceType("LOCAL_FILE_PATH");
                        }
                      }}
                      value={assetType}
                    >
                      <option value="CLIP">Clip</option>
                      <option value="VOD">VOD</option>
                      <option value="EDIT">Edited video</option>
                    </select>
                  </label>

                  <label className="search-block">
                    <span className="input-label">Scope</span>
                    <select
                      className="search-input"
                      disabled={isCreatingMediaAsset}
                      onChange={(event) =>
                        setAssetScope(event.target.value as MediaLibraryAssetScope)
                      }
                      value={assetScope}
                    >
                      <option value="GLOBAL">Global</option>
                      <option value="PROFILE">Selected profile</option>
                    </select>
                    <small className="analysis-field-note">
                      {assetScope === "PROFILE"
                        ? selectedProfile
                          ? `This asset will attach to ${selectedProfile.name}.`
                          : "Choose a profile first to use profile scope."
                        : "Global assets stay reusable across the full library."}
                    </small>
                  </label>
                </div>

                <label className="search-block">
                  <span className="input-label">Source type</span>
                  <select
                    className="search-input"
                    disabled={isCreatingMediaAsset}
                    onChange={(event) =>
                      setAssetSourceType(event.target.value as ExampleClipSourceType)
                    }
                    value={assetSourceType}
                  >
                    {availableAssetSourceTypes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="analysis-field-note">
                    {selectedAssetSourceType?.hint}
                  </small>
                </label>

                <label className="search-block">
                  <span className="input-label">
                    {assetSourceType === "LOCAL_FILE_PATH" ||
                    assetSourceType === "LOCAL_FILE_UPLOAD"
                      ? "Local path or file"
                      : "Source URL"}
                  </span>
                  <input
                    className="search-input"
                    disabled={isCreatingMediaAsset}
                    onChange={(event) => setAssetSourceValue(event.target.value)}
                    placeholder={
                      assetType === "VOD"
                        ? "/Volumes/Archive/session-vod.mkv"
                        : assetType === "EDIT"
                          ? "/Users/you/Exports/session-edit.mp4"
                          : assetSourceType === "TWITCH_CLIP_URL"
                            ? "https://clips.twitch.tv/..."
                            : assetSourceType === "YOUTUBE_SHORT_URL"
                              ? "https://www.youtube.com/shorts/..."
                              : "/Users/you/Clips/example.mp4"
                    }
                    type="text"
                    value={assetSourceValue}
                  />
                </label>

                {usesLocalAssetPicker ? (
                  <div className="action-row">
                    <button
                      className="button-secondary"
                      disabled={isCreatingMediaAsset}
                      onClick={() => {
                        void handlePickMediaLibraryAsset(assetSourceType);
                      }}
                      type="button"
                    >
                      Choose local media
                    </button>
                  </div>
                ) : null}

                <div className="analysis-inline-grid">
                  <label className="search-block">
                    <span className="input-label">Optional title</span>
                    <input
                      className="search-input"
                      disabled={isCreatingMediaAsset}
                      onChange={(event) => setAssetTitle(event.target.value)}
                      placeholder={
                        assetType === "VOD"
                          ? "March 12 full VOD"
                          : assetType === "EDIT"
                            ? "March 12 final cut"
                            : "Reusable opener clip"
                      }
                      type="text"
                      value={assetTitle}
                    />
                  </label>

                  <label className="search-block">
                    <span className="input-label">Optional note</span>
                    <input
                      className="search-input"
                      disabled={isCreatingMediaAsset}
                      onChange={(event) => setAssetNote(event.target.value)}
                      placeholder="Why this media matters"
                      type="text"
                      value={assetNote}
                    />
                  </label>
                </div>

                <div className="action-row">
                  <button
                    className="button-primary"
                    disabled={
                      isCreatingMediaAsset ||
                      !assetSourceValue.trim() ||
                      (assetScope === "PROFILE" && !selectedProfileId)
                    }
                    onClick={() => {
                      void handleCreateMediaAsset();
                    }}
                    type="button"
                  >
                    {isCreatingMediaAsset
                      ? "Saving asset..."
                      : "Add media asset"}
                  </button>
                </div>
              </div>
            </article>

            <article className="utility-block">
              <div className="panel-header">
                <div>
                  <span className="detail-label">Media assets</span>
                  <h2>Saved library media</h2>
                </div>
                {isLoadingLibraryAssets ? (
                  <span className="queue-count">Refreshing…</span>
                ) : null}
              </div>

              {libraryAssets.length === 0 ? (
                <p className="queue-summary-copy">
                  No library assets saved yet.
                </p>
              ) : null}

              <div className="profile-example-list">
                {libraryAssets.map((asset) => {
                  const latestIndexJob = latestIndexJobByAssetId.get(asset.id);
                  const hasActiveIndexJob =
                    latestIndexJob?.status === "QUEUED" ||
                    latestIndexJob?.status === "RUNNING";
                  const canIndexAsset =
                    asset.sourceType === "LOCAL_FILE_PATH" ||
                    asset.sourceType === "LOCAL_FILE_UPLOAD";
                  const selectedThumbnailSuggestionIds = new Set(
                    asset.thumbnailOutputSet?.outputs.map(
                      (output) => output.sourceSuggestionId,
                    ) ?? [],
                  );
                  const isSavingThumbnailOutputs = Boolean(
                    savingThumbnailOutputAssetIds[asset.id],
                  );
                  const hasTechnicalDetails = Boolean(
                    asset.statusDetail ||
                      asset.indexSummary ||
                      asset.indexArtifactSummary?.latestAudioFingerprintArtifactId ||
                      asset.featureSummary ||
                      latestIndexJob,
                  );
                  const hasThumbnailDetails = Boolean(
                    asset.thumbnailOutputSet?.outputs.length ||
                      asset.thumbnailSuggestionSet,
                  );

                  return (
                    <article className="profile-example-card" key={asset.id}>
                      <div className="profile-example-top">
                        <span className="detail-label">
                          {formatAssetType(asset.assetType)} •{" "}
                          {formatAssetScope(asset.scope)}
                        </span>
                        <span className="session-state-pill active-session">
                          {formatStatus(asset.status)}
                        </span>
                      </div>
                      <strong>{asset.title || "Untitled media asset"}</strong>
                      <p className="profile-example-source">{asset.sourceValue}</p>
                      <p className="queue-summary-copy">
                        {describeAssetPrimaryStatus(asset, latestIndexJob)}
                      </p>
                      {asset.assetType === "EDIT" &&
                      asset.thumbnailSuggestionSet ? (
                        <p className="queue-summary-copy">
                          Likely thumbnail moments ready •{" "}
                          {asset.thumbnailSuggestionSet.suggestions.length} picks
                        </p>
                      ) : null}
                      {asset.note ? <p>{asset.note}</p> : null}
                      {canIndexAsset ? (
                        <div className="action-row">
                          <button
                            className="button-secondary"
                            disabled={isCreatingMediaIndexJob || hasActiveIndexJob}
                            onClick={() => {
                              void onCreateMediaIndexJob({ assetId: asset.id });
                            }}
                            type="button"
                          >
                            {buildAssetAnalysisActionLabel(
                              asset,
                              latestIndexJob,
                              hasActiveIndexJob,
                            )}
                          </button>
                          {hasActiveIndexJob && latestIndexJob ? (
                            <button
                              className="button-secondary"
                              disabled={Boolean(
                                cancellingMediaIndexJobIds[latestIndexJob.id],
                              )}
                              onClick={() => {
                                void onCancelMediaIndexJob({
                                  jobId: latestIndexJob.id,
                                });
                              }}
                              type="button"
                            >
                              {cancellingMediaIndexJobIds[latestIndexJob.id]
                                ? "Cancelling..."
                                : "Cancel analysis"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {hasTechnicalDetails ? (
                        <details className="internal-details asset-card-details">
                          <summary className="internal-details-summary">
                            <span>Details</span>
                            <span className="queue-count">Optional</span>
                          </summary>
                          {asset.statusDetail ? (
                            <p className="queue-summary-copy">{asset.statusDetail}</p>
                          ) : null}
                          <p className="queue-summary-copy">
                            Source {formatSourceType(asset.sourceType)}
                            {asset.profileId ? ` • profile ${asset.profileId}` : ""}
                          </p>
                          {asset.indexSummary ? (
                            <p className="queue-summary-copy">
                              Analysis ready • {formatIndexSummary(asset.indexSummary)}
                            </p>
                          ) : null}
                          {asset.indexArtifactSummary?.latestAudioFingerprintArtifactId ? (
                            <p className="queue-summary-copy">
                              Audio artifact ready •{" "}
                              {formatAudioFingerprintMethod(
                                asset.indexArtifactSummary.audioFingerprintMethod,
                              )}
                              {" • "}
                              {asset.indexArtifactSummary.audioFingerprintBucketCount} buckets
                              {asset.indexArtifactSummary.bucketDurationSeconds
                                ? ` • ${formatDuration(asset.indexArtifactSummary.bucketDurationSeconds)} buckets`
                                : ""}
                              {asset.indexArtifactSummary.confidenceScore !== undefined
                                ? ` • ${formatRatio(asset.indexArtifactSummary.confidenceScore)} confidence`
                                : ""}
                            </p>
                          ) : null}
                          {asset.featureSummary ? (
                            <p className="queue-summary-copy">
                              Local summary ready • duration{" "}
                              {Math.round(asset.featureSummary.durationSeconds)}s
                              {asset.featureSummary.transcriptAnchorTerms.length > 0
                                ? ` • anchors ${formatTranscriptAnchors(asset.featureSummary.transcriptAnchorTerms)}`
                                : ""}{" "}
                              • top signals{" "}
                              {formatTopReasons(asset.featureSummary.topReasonCodes)}
                            </p>
                          ) : null}
                          {latestIndexJob ? (
                            <p className="queue-summary-copy">
                              Latest background job:{" "}
                              {formatIndexJobStatus(latestIndexJob.status)}
                              {" • "}
                              {Math.round(latestIndexJob.progress * 100)}%
                              {" • "}
                              {latestIndexJob.statusDetail}
                              {latestIndexJob.errorMessage
                                ? ` • ${latestIndexJob.errorMessage}`
                                : ""}
                            </p>
                          ) : null}
                        </details>
                      ) : null}
                      {hasThumbnailDetails ? (
                        <details className="internal-details asset-card-details">
                          <summary className="internal-details-summary">
                            <span>Likely thumbnail moments</span>
                            <span className="queue-count">
                              {asset.thumbnailSuggestionSet?.suggestions.length ??
                                asset.thumbnailOutputSet?.outputs.length ??
                                0}{" "}
                              ready
                            </span>
                          </summary>
                          {asset.thumbnailOutputSet?.outputs.length ? (
                            <>
                              <p className="queue-summary-copy">
                                Chosen thumbnails • {asset.thumbnailOutputSet.outputs.length} output
                                {asset.thumbnailOutputSet.outputs.length === 1
                                  ? ""
                                  : "s"}
                              </p>
                              <div className="thumbnail-suggestion-grid chosen">
                                {asset.thumbnailOutputSet.outputs.map((output) => (
                                  <figure
                                    className="thumbnail-suggestion-card is-selected"
                                    key={output.id}
                                  >
                                    <img
                                      alt={`Chosen thumbnail at ${formatClockDuration(output.timestampSeconds)}`}
                                      className="thumbnail-suggestion-image"
                                      loading="lazy"
                                      src={toLocalImageSrc(output.imagePath)}
                                    />
                                    <figcaption className="thumbnail-suggestion-meta">
                                      <strong>
                                        {formatClockDuration(output.timestampSeconds)}
                                      </strong>
                                      <span>
                                        Output {output.position + 1} • score{" "}
                                        {formatRatio(output.score)}
                                      </span>
                                      <button
                                        className="button-secondary thumbnail-suggestion-action"
                                        disabled={isSavingThumbnailOutputs}
                                        onClick={() => {
                                          void onReplaceThumbnailOutputs(asset.id, {
                                            selectedSuggestionIds:
                                              asset.thumbnailOutputSet?.outputs
                                                .filter(
                                                  (candidateOutput) =>
                                                    candidateOutput.id !== output.id,
                                                )
                                                .map(
                                                  (candidateOutput) =>
                                                    candidateOutput.sourceSuggestionId,
                                                ) ?? [],
                                          });
                                        }}
                                        type="button"
                                      >
                                        {isSavingThumbnailOutputs
                                          ? "Saving..."
                                          : "Remove output"}
                                      </button>
                                    </figcaption>
                                  </figure>
                                ))}
                              </div>
                            </>
                          ) : null}
                          {asset.thumbnailSuggestionSet ? (
                            <>
                              <p className="queue-summary-copy">
                                {asset.thumbnailSuggestionSet.suggestions.length} picks
                                {" • "}sampled{" "}
                                {asset.thumbnailSuggestionSet.sampleWindowCount} windows
                              </p>
                              <div className="thumbnail-suggestion-grid">
                                {asset.thumbnailSuggestionSet.suggestions.map(
                                  (suggestion) => (
                                    <figure
                                      className={
                                        selectedThumbnailSuggestionIds.has(
                                          suggestion.id,
                                        )
                                          ? "thumbnail-suggestion-card is-selected"
                                          : "thumbnail-suggestion-card"
                                      }
                                      key={suggestion.id}
                                    >
                                      <img
                                        alt={`Thumbnail suggestion at ${formatClockDuration(suggestion.timestampSeconds)}`}
                                        className="thumbnail-suggestion-image"
                                        loading="lazy"
                                        src={toLocalImageSrc(suggestion.imagePath)}
                                      />
                                      <figcaption className="thumbnail-suggestion-meta">
                                        <strong>
                                          {formatClockDuration(
                                            suggestion.timestampSeconds,
                                          )}
                                        </strong>
                                        <span>
                                          Score {formatRatio(suggestion.score)} • activity{" "}
                                          {formatRatio(suggestion.activityScore)}
                                        </span>
                                        <span>{suggestion.note}</span>
                                        <button
                                          className={
                                            selectedThumbnailSuggestionIds.has(
                                              suggestion.id,
                                            )
                                              ? "button-primary thumbnail-suggestion-action"
                                              : "button-secondary thumbnail-suggestion-action"
                                          }
                                          disabled={isSavingThumbnailOutputs}
                                          onClick={() => {
                                            const currentIds =
                                              asset.thumbnailOutputSet?.outputs.map(
                                                (output) =>
                                                  output.sourceSuggestionId,
                                              ) ?? [];
                                            const nextSelectedSuggestionIds =
                                              selectedThumbnailSuggestionIds.has(
                                                suggestion.id,
                                              )
                                                ? currentIds.filter(
                                                    (selectedSuggestionId) =>
                                                      selectedSuggestionId !==
                                                      suggestion.id,
                                                  )
                                                : [...currentIds, suggestion.id];
                                            void onReplaceThumbnailOutputs(
                                              asset.id,
                                              {
                                                selectedSuggestionIds:
                                                  nextSelectedSuggestionIds,
                                              },
                                            );
                                          }}
                                          type="button"
                                        >
                                          {isSavingThumbnailOutputs
                                            ? "Saving..."
                                            : selectedThumbnailSuggestionIds.has(
                                                  suggestion.id,
                                                )
                                              ? "Chosen output"
                                              : "Promote to output"}
                                        </button>
                                      </figcaption>
                                    </figure>
                                  ),
                                )}
                              </div>
                            </>
                          ) : null}
                        </details>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </article>
            </details>

            <details className="utility-block internal-details advanced-lab-section">
              <summary className="internal-details-summary">
                <span>VOD/edit audits</span>
                <span className="queue-count">
                  {isLoadingMediaPairs || isLoadingMediaAlignmentJobs
                    ? "Refreshing…"
                    : `${mediaEditPairs.length} saved`}
                </span>
              </summary>

            <article className="utility-block">
              <div className="panel-header">
                <div>
                  <span className="detail-label">VOD/edit comparison</span>
                  <h2>Compare a VOD to its edit</h2>
                  <p>
                    Use this when you want HighlightSmith to compare a source
                    VOD against its finished edit to inspect what got kept,
                    removed, or potentially missed.
                  </p>
                </div>
              </div>

              <div className="analysis-form">
                <div className="analysis-inline-grid">
                  <label className="search-block">
                    <span className="input-label">Source VOD</span>
                    <select
                      className="search-input"
                      disabled={isCreatingMediaPair || vodAssetOptions.length === 0}
                      onChange={(event) => setSelectedVodAssetId(event.target.value)}
                      value={selectedVodAssetId}
                    >
                      <option value="">
                        {vodAssetOptions.length === 0
                          ? "No VOD assets yet"
                          : "Choose source VOD"}
                      </option>
                      {vodAssetOptions.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.title || asset.sourceValue}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="search-block">
                    <span className="input-label">Edited video</span>
                    <select
                      className="search-input"
                      disabled={
                        isCreatingMediaPair || editAssetOptions.length === 0
                      }
                      onChange={(event) => setSelectedEditAssetId(event.target.value)}
                      value={selectedEditAssetId}
                    >
                      <option value="">
                        {editAssetOptions.length === 0
                          ? "No edit assets yet"
                          : "Choose edited video"}
                      </option>
                      {editAssetOptions.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.title || asset.sourceValue}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="analysis-inline-grid">
                  <label className="search-block">
                    <span className="input-label">Pair scope</span>
                    <select
                      className="search-input"
                      disabled={isCreatingMediaPair}
                      onChange={(event) =>
                        setPairScope(event.target.value as MediaLibraryAssetScope)
                      }
                      value={pairScope}
                    >
                      <option value="GLOBAL">Global</option>
                      <option value="PROFILE">Selected profile</option>
                    </select>
                  </label>

                  <label className="search-block">
                    <span className="input-label">Optional title</span>
                    <input
                      className="search-input"
                      disabled={isCreatingMediaPair}
                      onChange={(event) => setPairTitle(event.target.value)}
                      placeholder="March 12 VOD/edit comparison"
                      type="text"
                      value={pairTitle}
                    />
                  </label>
                </div>

                <label className="search-block">
                  <span className="input-label">Optional note</span>
                  <input
                    className="search-input"
                    disabled={isCreatingMediaPair}
                    onChange={(event) => setPairNote(event.target.value)}
                    placeholder="What should HS learn from this comparison?"
                    type="text"
                    value={pairNote}
                  />
                </label>

                <div className="action-row">
                  <button
                    className="button-primary"
                    disabled={
                      isCreatingMediaPair ||
                      !selectedVodAssetId ||
                      !selectedEditAssetId ||
                      (pairScope === "PROFILE" && !selectedProfileId)
                    }
                    onClick={() => {
                      void handleCreateMediaPair();
                    }}
                    type="button"
                  >
                    {isCreatingMediaPair
                      ? "Saving comparison..."
                      : "Save VOD/edit comparison"}
                  </button>
                </div>
              </div>
            </article>

            <article className="utility-block">
              <div className="panel-header">
                <div>
                  <span className="detail-label">Saved VOD/edit audits</span>
                  <h2>Comparison history</h2>
                </div>
                <span className="queue-count">
                  {isLoadingMediaPairs || isLoadingMediaAlignmentJobs
                    ? "Refreshing…"
                    : `${mediaEditPairs.length} saved`}
                </span>
              </div>

              {mediaEditPairs.length === 0 ? (
                <p className="queue-summary-copy">
                  No VOD/edit audits saved yet.
                </p>
              ) : null}

              <div className="profile-example-list">
                {mediaEditPairs.map((pair) => {
              const latestAlignmentJob = latestAlignmentJobByPairId.get(pair.id);
              const pairMatches = mediaAlignmentMatches.filter(
                (match) => match.pairId === pair.id,
              );
              const hasActiveAlignmentJob =
                latestAlignmentJob?.status === "QUEUED" ||
                latestAlignmentJob?.status === "RUNNING";
              const sourceAsset = mediaAssetById.get(pair.vodAssetId);
              const editAsset = mediaAssetById.get(pair.editAssetId);
              const sourceAssetHasAudioFingerprint =
                mediaAssetHasAudioFingerprint(sourceAsset);
              const editAssetHasAudioFingerprint =
                mediaAssetHasAudioFingerprint(editAsset);
              const sourceIndexJob = latestIndexJobByAssetId.get(pair.vodAssetId);
              const editIndexJob = latestIndexJobByAssetId.get(pair.editAssetId);
              const sourceIndexInFlight =
                sourceIndexJob?.status === "QUEUED" ||
                sourceIndexJob?.status === "RUNNING";
              const editIndexInFlight =
                editIndexJob?.status === "QUEUED" ||
                editIndexJob?.status === "RUNNING";
              const pairAlignmentBlockedReason = describePairAlignmentBlockedReason(
                sourceAsset,
                editAsset,
              );
              const pairAlignmentButtonLabel = pairAlignmentBlockedReason
                ? describePairAlignmentBlockedAction(
                    sourceAssetHasAudioFingerprint,
                    editAssetHasAudioFingerprint,
                  )
                : "Align edit to VOD";

              return (
              <article className="profile-example-card" key={pair.id}>
                <div className="profile-example-top">
                  <span className="detail-label">VOD + edit audit</span>
                  <span className="session-state-pill active-session">
                    {formatPairStatus(pair.status)}
                  </span>
                </div>
                <strong>{pair.title || "Untitled VOD/edit audit"}</strong>
                <p className="queue-summary-copy">
                  Source asset {pair.vodAssetId} • edit asset {pair.editAssetId}
                </p>
                {pair.note ? <p>{pair.note}</p> : null}
                <p className="queue-summary-copy">{pair.statusDetail}</p>
                {pair.keepRatio !== undefined ? (
                  <p className="queue-summary-copy">
                    Source {formatDuration(pair.sourceDurationSeconds)} • edit{" "}
                    {formatDuration(pair.editDurationSeconds)} • keep ratio{" "}
                    {formatRatio(pair.keepRatio)} • compression{" "}
                    {pair.compressionRatio?.toFixed(2)}x
                  </p>
                ) : null}
                {latestAlignmentJob ? (
                  <p className="queue-summary-copy">
                    Latest alignment job:{" "}
                    {formatAlignmentJobStatus(latestAlignmentJob.status)}
                    {" • "}
                    {Math.round(latestAlignmentJob.progress * 100)}%
                    {" • "}
                    {latestAlignmentJob.statusDetail}
                    {latestAlignmentJob.errorMessage
                      ? ` • ${latestAlignmentJob.errorMessage}`
                      : ""}
                  </p>
                ) : null}
                {pairAlignmentBlockedReason ? (
                  <p className="queue-summary-copy">
                    Alignment blocked • {pairAlignmentBlockedReason}
                  </p>
                ) : null}
                {pairMatches.length > 0 ? (
                  <div className="profile-example-list">
                    {pairMatches.slice(0, 3).map((match) => (
                      <article className="profile-example-card" key={match.id}>
                        <div className="profile-example-top">
                          <span className="detail-label">
                            Alignment match
                          </span>
                          <span className="session-state-pill next-target">
                            {formatRatio(match.confidenceScore)} confidence
                          </span>
                        </div>
                        <p className="queue-summary-copy">
                          Source{" "}
                          {formatDuration(match.sourceRange.startSeconds)}-
                          {formatDuration(match.sourceRange.endSeconds)}
                          {" • "}Edit{" "}
                          {formatDuration(match.queryRange.startSeconds)}-
                          {formatDuration(match.queryRange.endSeconds)}
                          {" • "}score {formatRatio(match.score)}
                        </p>
                        <p>{match.note}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
                {pair.alignmentSegments.length > 0 ? (
                  <div className="profile-example-list">
                    {pair.alignmentSegments.map((segment) => (
                      <article
                        className="profile-example-card"
                        key={segment.id}
                      >
                        <div className="profile-example-top">
                          <span className="detail-label">
                            {formatAlignmentKind(segment.kind)}
                          </span>
                          <span className="session-state-pill next-target">
                            {formatRatio(segment.confidenceScore)} confidence
                          </span>
                        </div>
                        <p className="queue-summary-copy">
                          {formatAlignmentRange("Source", segment.sourceRange)}
                          {" • "}
                          {formatAlignmentRange("Edit", segment.editRange)}
                        </p>
                        <p>{segment.note}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
                <div className="action-row">
                  {!sourceAssetHasAudioFingerprint && sourceAsset ? (
                    <button
                      className="button-secondary"
                      disabled={isCreatingMediaIndexJob || sourceIndexInFlight}
                      onClick={() => {
                        void onCreateMediaIndexJob({ assetId: sourceAsset.id });
                      }}
                      type="button"
                    >
                      {sourceIndexInFlight
                        ? "Analyzing source..."
                        : "Analyze source VOD"}
                    </button>
                  ) : null}
                  {!editAssetHasAudioFingerprint && editAsset ? (
                    <button
                      className="button-secondary"
                      disabled={isCreatingMediaIndexJob || editIndexInFlight}
                      onClick={() => {
                        void onCreateMediaIndexJob({ assetId: editAsset.id });
                      }}
                      type="button"
                    >
                      {editIndexInFlight
                        ? "Analyzing edit..."
                        : "Analyze edited video"}
                    </button>
                  ) : null}
                  <button
                    className="button-secondary"
                    disabled={
                      isCreatingMediaAlignmentJob ||
                      hasActiveAlignmentJob ||
                      Boolean(pairAlignmentBlockedReason)
                    }
                    onClick={() => {
                      void onCreateMediaAlignmentJob({ pairId: pair.id });
                    }}
                    type="button"
                  >
                    {hasActiveAlignmentJob
                      ? "Aligning..."
                      : pairAlignmentButtonLabel}
                  </button>
                  {hasActiveAlignmentJob && latestAlignmentJob ? (
                    <button
                      className="button-secondary"
                      disabled={Boolean(
                        cancellingMediaAlignmentJobIds[latestAlignmentJob.id],
                      )}
                      onClick={() => {
                        void onCancelMediaAlignmentJob({
                          jobId: latestAlignmentJob.id,
                        });
                      }}
                      type="button"
                    >
                      {cancellingMediaAlignmentJobIds[latestAlignmentJob.id]
                        ? "Cancelling..."
                        : "Cancel alignment"}
                    </button>
                  ) : null}
                </div>
              </article>
              );
                })}
              </div>
            </article>
            </details>
          </div>
        </details>
      </div>
    </section>
  );
}

function formatTimestamp(value: string): string {
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

function formatSourceType(sourceType: ExampleClipSourceType): string {
  if (sourceType === "TWITCH_CLIP_URL") {
    return "Twitch clip URL";
  }

  if (sourceType === "YOUTUBE_SHORT_URL") {
    return "YouTube Short URL";
  }

  if (sourceType === "LOCAL_FILE_UPLOAD") {
    return "Local clip file";
  }

  return "Local clip path";
}

function formatReferenceKind(
  referenceKind: ExampleReferenceKind,
  sourceType: ExampleClipSourceType,
): string {
  if (referenceKind === "PROFILE_EDIT") {
    return "Profile edit reference";
  }

  return formatSourceType(sourceType);
}

function formatReferenceSummaryLabel(
  referenceKind: ExampleReferenceKind,
): string {
  return referenceKind === "PROFILE_EDIT"
    ? "Indexed edit summary ready"
    : "Local clip summary ready";
}

function formatAssetType(assetType: MediaLibraryAssetType): string {
  if (assetType === "VOD") {
    return "VOD";
  }

  if (assetType === "EDIT") {
    return "Edited video";
  }

  return "Clip";
}

function formatAssetScope(scope: MediaLibraryAssetScope): string {
  return scope === "GLOBAL" ? "Global" : "Profile";
}

function formatIndexJobStatus(status: MediaIndexJob["status"]): string {
  if (status === "QUEUED") {
    return "Queued";
  }

  if (status === "RUNNING") {
    return "Running";
  }

  if (status === "SUCCEEDED") {
    return "Succeeded";
  }

  if (status === "FAILED") {
    return "Failed";
  }

  return "Cancelled";
}

function formatAlignmentJobStatus(status: MediaAlignmentJob["status"]): string {
  if (status === "QUEUED") {
    return "Queued";
  }

  if (status === "RUNNING") {
    return "Running";
  }

  if (status === "SUCCEEDED") {
    return "Succeeded";
  }

  if (status === "FAILED") {
    return "Failed";
  }

  return "Cancelled";
}

function formatIndexSummary(
  summary: NonNullable<MediaLibraryAsset["indexSummary"]>,
): string {
  const resolution =
    summary.width && summary.height ? ` • ${summary.width}x${summary.height}` : "";
  const codecs = [
    summary.videoCodec ? `video ${summary.videoCodec}` : null,
    summary.audioCodec ? `audio ${summary.audioCodec}` : null,
  ].filter(Boolean);

  return [
    `${formatDuration(summary.durationSeconds)}`,
    `${formatFileSize(summary.fileSizeBytes)}`,
    `${summary.kind.toLowerCase()} ${summary.format}`,
    codecs.length > 0 ? codecs.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" • ")
    .concat(resolution);
}

function formatAudioFingerprintMethod(
  method: NonNullable<
    MediaLibraryAsset["indexArtifactSummary"]
  >["audioFingerprintMethod"],
): string {
  if (method === "DECODED_AUDIO_FINGERPRINT_V1") {
    return "decoded audio";
  }

  if (method === "BYTE_SAMPLED_AUDIO_PROXY_V1") {
    return "byte proxy";
  }

  return "unknown method";
}

function formatAlignmentMethod(method: MediaAlignmentJob["method"]): string {
  if (method === "DECODED_AUDIO_BUCKET_CORRELATION_V1") {
    return "decoded audio";
  }

  if (method === "AUDIO_PROXY_BUCKET_CORRELATION_V1") {
    return "byte proxy";
  }

  return "unknown method";
}

function formatPairStatus(status: MediaEditPair["status"]): string {
  return status === "READY" ? "Ready" : "Incomplete";
}

function formatAlignmentKind(
  kind: MediaEditPair["alignmentSegments"][number]["kind"],
): string {
  if (kind === "PROVISIONAL_KEEP") {
    return "Provisional kept edit";
  }

  if (kind === "PROVISIONAL_REMOVED_POOL") {
    return "Provisional removed pool";
  }

  if (kind === "CONFIRMED_KEEP") {
    return "Confirmed keep";
  }

  return "Confirmed removal";
}

function formatAlignmentRange(
  label: string,
  range: MediaEditPair["alignmentSegments"][number]["sourceRange"],
): string {
  if (!range) {
    return `${label} unresolved`;
  }

  return `${label} ${formatDuration(range.startSeconds)}-${formatDuration(range.endSeconds)}`;
}

function formatStatus(status: ExampleClip["status"] | MediaLibraryAsset["status"]): string {
  if (status === "LOCAL_FILE_AVAILABLE") {
    return "Local file found";
  }

  if (status === "MISSING_LOCAL_FILE") {
    return "Path missing";
  }

  return "Reference only";
}

function formatTopReasons(
  reasonCodes:
    | NonNullable<ExampleClip["featureSummary"]>["topReasonCodes"]
    | NonNullable<MediaLibraryAsset["featureSummary"]>["topReasonCodes"],
) {
  if (!reasonCodes || reasonCodes.length === 0) {
    return "none yet";
  }

  return reasonCodes.join(", ");
}

function formatTranscriptAnchors(
  terms:
    | NonNullable<ExampleClip["featureSummary"]>["transcriptAnchorTerms"]
    | NonNullable<MediaLibraryAsset["featureSummary"]>["transcriptAnchorTerms"],
) {
  if (!terms || terms.length === 0) {
    return "none yet";
  }

  return terms.slice(0, 3).join(", ");
}

function formatDuration(value: number | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  if (value >= 3600) {
    return `${(value / 3600).toFixed(1)}h`;
  }

  if (value >= 60) {
    return `${Math.round(value / 60)}m`;
  }

  return `${Math.round(value)}s`;
}

function formatClockDuration(value: number | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  const totalSeconds = Math.max(0, Math.round(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatRatio(value: number | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}

function formatFileSize(value: number) {
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)}MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }

  return `${value}B`;
}

function describeBackgroundActivity(
  activeIndexJobCount: number,
  activeAlignmentJobCount: number,
): string {
  if (activeIndexJobCount > 0 && activeAlignmentJobCount > 0) {
    return `HS is analyzing ${activeIndexJobCount} asset${activeIndexJobCount === 1 ? "" : "s"} and comparing ${activeAlignmentJobCount} VOD/edit pair${activeAlignmentJobCount === 1 ? "" : "s"}.`;
  }

  if (activeIndexJobCount > 0) {
    return `HS is analyzing ${activeIndexJobCount} asset${activeIndexJobCount === 1 ? "" : "s"} right now.`;
  }

  return `HS is comparing ${activeAlignmentJobCount} VOD/edit pair${activeAlignmentJobCount === 1 ? "" : "s"} right now.`;
}

function describeAssetPrimaryStatus(
  asset: MediaLibraryAsset,
  latestIndexJob: MediaIndexJob | undefined,
): string {
  if (
    latestIndexJob?.status === "QUEUED" ||
    latestIndexJob?.status === "RUNNING"
  ) {
    if (asset.assetType === "VOD") {
      return "HS is scanning this VOD in the background.";
    }

    if (asset.assetType === "EDIT") {
      return "HS is analyzing this edited video in the background.";
    }

    return "HS is analyzing this clip in the background.";
  }

  if (latestIndexJob?.status === "FAILED") {
    return "The last analysis attempt failed. Open details to see what happened.";
  }

  if (asset.status === "MISSING_LOCAL_FILE") {
    return "The local file is unavailable right now. Reconnect it before running analysis.";
  }

  if (asset.assetType === "EDIT" && asset.scope === "PROFILE") {
    return asset.featureSummary
      ? "Ready to guide future matching for this profile."
      : "Analyze this edit to turn it into a longform reference for this profile.";
  }

  if (asset.assetType === "VOD") {
    return asset.featureSummary
      ? "Ready for future VOD comparison work."
      : "Scan this VOD when you want full-source analysis or comparison work.";
  }

  if (asset.assetType === "CLIP") {
    return asset.featureSummary
      ? "Ready as a reusable clip reference."
      : "Analyze this clip to make it more useful in future matching.";
  }

  return asset.featureSummary
    ? "Analysis ready."
    : "Analyze this edited video to make it usable in future matching.";
}

function buildAssetAnalysisActionLabel(
  asset: MediaLibraryAsset,
  latestIndexJob: MediaIndexJob | undefined,
  hasActiveIndexJob: boolean,
): string {
  if (hasActiveIndexJob) {
    if (asset.assetType === "EDIT") {
      return "Analyzing edit...";
    }

    if (asset.assetType === "VOD") {
      return "Scanning VOD...";
    }

    return "Analyzing clip...";
  }

  if (latestIndexJob) {
    if (asset.assetType === "EDIT") {
      return "Refresh edit analysis";
    }

    if (asset.assetType === "VOD") {
      return "Refresh VOD scan";
    }

    return "Refresh clip analysis";
  }

  if (asset.assetType === "EDIT") {
    return "Analyze edited video";
  }

  if (asset.assetType === "VOD") {
    return "Scan VOD";
  }

  return "Analyze clip";
}

function mediaAssetHasAudioFingerprint(
  asset: MediaLibraryAsset | undefined,
): boolean {
  return Boolean(asset?.indexArtifactSummary?.latestAudioFingerprintArtifactId);
}

function parseTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function describePairAlignmentBlockedReason(
  sourceAsset: MediaLibraryAsset | undefined,
  editAsset: MediaLibraryAsset | undefined,
): string | null {
  if (!sourceAsset || !editAsset) {
    return "One or both paired media records are unavailable locally.";
  }

  const sourceReady = mediaAssetHasAudioFingerprint(sourceAsset);
  const editReady = mediaAssetHasAudioFingerprint(editAsset);
  if (sourceReady && editReady) {
    return null;
  }

  if (!sourceReady && !editReady) {
    return "Both the source VOD and edited video need completed analysis first.";
  }

  if (!sourceReady) {
    return "The source VOD still needs completed analysis before alignment can run.";
  }

  return "The edited video still needs completed analysis before alignment can run.";
}

function describePairAlignmentBlockedAction(
  sourceAssetHasAudioFingerprint: boolean,
  editAssetHasAudioFingerprint: boolean,
): string {
  if (!sourceAssetHasAudioFingerprint && !editAssetHasAudioFingerprint) {
    return "Analyze both assets first";
  }

  if (!sourceAssetHasAudioFingerprint) {
    return "Analyze source VOD first";
  }

  return "Analyze edited video first";
}

function toLocalImageSrc(imagePath: string) {
  try {
    return convertFileSrc(imagePath);
  } catch {
    return imagePath;
  }
}
