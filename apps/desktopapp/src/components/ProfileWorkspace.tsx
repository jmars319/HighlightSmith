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
              <h2>Example-driven profile library</h2>
              <p>
                Save real scouting profiles now. Example links and local clip
                references stay durable even before matching is turned on.
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
                      {profile.exampleClips.length} examples
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
                      "No description yet. Add context and example clips to make this profile more useful."}
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
                  <span className="detail-label">Saved examples</span>
                  <strong>{selectedProfile.exampleClips.length}</strong>
                  <p>
                    Stored durably. Local clips can feed heuristic matching;
                    Twitch and YouTube entries remain reference-only for now.
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Profile mode</span>
                  <strong>{selectedProfile.mode}</strong>
                  <p>
                    Matching is still conservative and heuristic. HighlightSmith
                    is not claiming semantic understanding here.
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span className="detail-label">Match readiness</span>
                  <strong>
                    {
                      selectedProfile.exampleClips.filter(
                        (example) => example.featureSummary,
                      ).length
                    }{" "}
                    usable local examples
                  </strong>
                  <p>
                    Twitch and YouTube references remain stored, but only local
                    files participate in heuristic matching right now.
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
                example references.
              </p>
            </>
          )}
        </article>

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Index jobs</span>
              <h2>Background media indexing</h2>
              <p>
                Jobs run in the analyzer with bounded probes so large media
                files do not block the desktop UI.
              </p>
            </div>
            {isLoadingMediaIndexJobs ? (
              <span className="queue-count">Refreshing…</span>
            ) : null}
          </div>

          {mediaIndexJobs.length === 0 ? (
            <p className="queue-summary-copy">
              No media index jobs have been started yet.
            </p>
          ) : null}

          <div className="profile-example-list">
            {mediaIndexJobs.slice(0, 6).map((job) => (
              <article className="profile-example-card" key={job.id}>
                <div className="profile-example-top">
                  <span className="detail-label">Asset {job.assetId}</span>
                  <span className="session-state-pill active-session">
                    {formatIndexJobStatus(job.status)}
                  </span>
                </div>
                <p className="queue-summary-copy">
                  {Math.round(job.progress * 100)}% • {job.statusDetail}
                </p>
                {job.result ? (
                  <p className="queue-summary-copy">
                    Result • {formatIndexSummary(job.result)}
                  </p>
                ) : null}
                {job.errorMessage ? (
                  <p className="analysis-error">{job.errorMessage}</p>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Media library</span>
              <h2>VODs, edits, and reusable clips</h2>
              <p>
                Clips stay universal. VODs and edits can be paired so
                HighlightSmith records the coarse keep/remove outcome without
                pretending timeline alignment exists yet.
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
              <span className="detail-label">Pairs</span>
              <strong>{mediaEditPairs.length}</strong>
              <p>
                Linked source/edit records that preserve the editorial outcome.
              </p>
            </article>
            <article className="analysis-summary-card">
              <span className="detail-label">Scope</span>
              <strong>{selectedProfile ? selectedProfile.name : "Global only"}</strong>
              <p>
                Profile scope uses the currently selected profile. Global scope
                stays reusable across the whole library.
              </p>
            </article>
          </div>
        </article>

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Register media asset</span>
              <h2>Asset intake</h2>
              <p>
                Add one clip, one source VOD, or one finished edit at a time.
                Large files stay path-based and summarize locally.
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
              <span className="detail-label">Connect source and edit</span>
              <h2>VOD + edit pairing</h2>
              <p>
                Pair one source VOD with one finished edit so HighlightSmith can
                remember the overall editorial compression and keep/remove
                outcome.
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
                  disabled={isCreatingMediaPair || editAssetOptions.length === 0}
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
                  placeholder="March 12 VOD + final cut"
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
                placeholder="What kind of editorial pass this represents"
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
                {isCreatingMediaPair ? "Saving pair..." : "Create VOD/edit pair"}
              </button>
            </div>
          </div>
        </article>

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Add example clip</span>
              <h2>Reference ingress</h2>
              <p>
                This pass stores references cleanly. HighlightSmith is not
                downloading Twitch or YouTube media yet.
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
                  : "Add example reference"}
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

          {error ? <p className="analysis-error">{error}</p> : null}

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
                  Source {formatSourceType(asset.sourceType)}
                  {asset.profileId ? ` • profile ${asset.profileId}` : ""}
                </p>
                {asset.note ? <p>{asset.note}</p> : null}
                {asset.statusDetail ? (
                  <p className="queue-summary-copy">{asset.statusDetail}</p>
                ) : null}
                {asset.indexSummary ? (
                  <p className="queue-summary-copy">
                    Index ready • {formatIndexSummary(asset.indexSummary)}
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
                {asset.thumbnailOutputSet?.outputs.length ? (
                  <>
                    <p className="queue-summary-copy">
                      Chosen thumbnails • {asset.thumbnailOutputSet.outputs.length} output
                      {asset.thumbnailOutputSet.outputs.length === 1 ? "" : "s"}
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
                            <strong>{formatClockDuration(output.timestampSeconds)}</strong>
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
                                      .filter((candidateOutput) =>
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
                              {isSavingThumbnailOutputs ? "Saving..." : "Remove output"}
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
                      Thumbnail suggestions ready •{" "}
                      {asset.thumbnailSuggestionSet.suggestions.length} picks
                      {" • "}
                      sampled {asset.thumbnailSuggestionSet.sampleWindowCount} windows
                    </p>
                    <div className="thumbnail-suggestion-grid">
                      {asset.thumbnailSuggestionSet.suggestions.map((suggestion) => (
                        <figure
                          className={
                            selectedThumbnailSuggestionIds.has(suggestion.id)
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
                            <strong>{formatClockDuration(suggestion.timestampSeconds)}</strong>
                            <span>
                              Score {formatRatio(suggestion.score)} • activity{" "}
                              {formatRatio(suggestion.activityScore)}
                            </span>
                            <span>{suggestion.note}</span>
                            <button
                              className={
                                selectedThumbnailSuggestionIds.has(suggestion.id)
                                  ? "button-primary thumbnail-suggestion-action"
                                  : "button-secondary thumbnail-suggestion-action"
                              }
                              disabled={isSavingThumbnailOutputs}
                              onClick={() => {
                                const currentIds =
                                  asset.thumbnailOutputSet?.outputs.map(
                                    (output) => output.sourceSuggestionId,
                                  ) ?? [];
                                const nextSelectedSuggestionIds =
                                  selectedThumbnailSuggestionIds.has(suggestion.id)
                                    ? currentIds.filter(
                                        (selectedSuggestionId) =>
                                          selectedSuggestionId !== suggestion.id,
                                      )
                                    : [...currentIds, suggestion.id];
                                void onReplaceThumbnailOutputs(asset.id, {
                                  selectedSuggestionIds:
                                    nextSelectedSuggestionIds,
                                });
                              }}
                              type="button"
                            >
                              {isSavingThumbnailOutputs
                                ? "Saving..."
                                : selectedThumbnailSuggestionIds.has(suggestion.id)
                                  ? "Chosen output"
                                  : "Promote to output"}
                            </button>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </>
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
                    Latest index job: {formatIndexJobStatus(latestIndexJob.status)}
                    {" • "}
                    {Math.round(latestIndexJob.progress * 100)}%
                    {" • "}
                    {latestIndexJob.statusDetail}
                    {latestIndexJob.errorMessage
                      ? ` • ${latestIndexJob.errorMessage}`
                      : ""}
                  </p>
                ) : null}
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
                      {hasActiveIndexJob
                        ? "Indexing..."
                        : latestIndexJob
                          ? "Refresh index"
                          : "Index media"}
                    </button>
                    {hasActiveIndexJob && latestIndexJob ? (
                      <button
                        className="button-secondary"
                        disabled={Boolean(cancellingMediaIndexJobIds[latestIndexJob.id])}
                        onClick={() => {
                          void onCancelMediaIndexJob({ jobId: latestIndexJob.id });
                        }}
                        type="button"
                      >
                        {cancellingMediaIndexJobIds[latestIndexJob.id]
                          ? "Cancelling..."
                          : "Cancel index"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
              );
            })}
          </div>
        </article>

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">VOD/edit pairs</span>
              <h2>Saved paired editorial records</h2>
            </div>
            {isLoadingMediaPairs ? (
              <span className="queue-count">Refreshing…</span>
            ) : null}
            {isLoadingMediaAlignmentJobs ? (
              <span className="queue-count">Alignment refreshing…</span>
            ) : null}
          </div>

          {mediaEditPairs.length === 0 ? (
            <p className="queue-summary-copy">
              No VOD/edit pairs saved yet.
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

              return (
              <article className="profile-example-card" key={pair.id}>
                <div className="profile-example-top">
                  <span className="detail-label">VOD + edit pair</span>
                  <span className="session-state-pill active-session">
                    {formatPairStatus(pair.status)}
                  </span>
                </div>
                <strong>{pair.title || "Untitled VOD/edit pair"}</strong>
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
                  <button
                    className="button-secondary"
                    disabled={isCreatingMediaAlignmentJob || hasActiveAlignmentJob}
                    onClick={() => {
                      void onCreateMediaAlignmentJob({ pairId: pair.id });
                    }}
                    type="button"
                  >
                    {hasActiveAlignmentJob
                      ? "Aligning..."
                      : "Align edit to VOD"}
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

        <article className="utility-block">
          <div className="panel-header">
            <div>
              <span className="detail-label">Profile examples</span>
              <h2>Saved example references</h2>
            </div>
            {isLoadingExamples ? (
              <span className="queue-count">Refreshing…</span>
            ) : null}
          </div>

          {selectedProfile && visibleExamples.length === 0 ? (
            <p className="queue-summary-copy">
              No example references saved yet for this profile.
            </p>
          ) : null}

          <div className="profile-example-list">
            {visibleExamples.map((example) => (
              <article className="profile-example-card" key={example.id}>
                <div className="profile-example-top">
                  <span className="detail-label">
                    {formatSourceType(example.sourceType)}
                  </span>
                  <span className="session-state-pill active-session">
                    {formatStatus(example.status)}
                  </span>
                </div>
                <strong>{example.title || "Untitled example reference"}</strong>
                <p className="profile-example-source">{example.sourceValue}</p>
                {example.note ? <p>{example.note}</p> : null}
                {example.statusDetail ? (
                  <p className="queue-summary-copy">{example.statusDetail}</p>
                ) : null}
                {example.featureSummary ? (
                  <p className="queue-summary-copy">
                    Local summary ready • duration{" "}
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

function toLocalImageSrc(imagePath: string) {
  try {
    return convertFileSrc(imagePath);
  } catch {
    return imagePath;
  }
}
