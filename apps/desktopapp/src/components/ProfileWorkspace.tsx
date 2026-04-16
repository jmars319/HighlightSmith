import { useState } from "react";
import { supportedInputExtensions } from "@highlightsmith/media";
import type {
  AddExampleClipRequest,
  ClipProfile,
  CreateClipProfileRequest,
  ExampleClip,
  ExampleClipSourceType,
} from "@highlightsmith/shared-types";

type ProfileWorkspaceProps = {
  profiles: ClipProfile[];
  selectedProfileId: string | null;
  selectedProfile: ClipProfile | null;
  examples: ExampleClip[];
  isLoadingProfiles: boolean;
  isLoadingExamples: boolean;
  isCreatingProfile: boolean;
  isAddingExample: boolean;
  error: string | null;
  onSelectProfile: (profileId: string) => void;
  onCreateProfile: (input: CreateClipProfileRequest) => Promise<void>;
  onAddExample: (
    profileId: string,
    input: AddExampleClipRequest,
  ) => Promise<void>;
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

export function ProfileWorkspace({
  profiles,
  selectedProfileId,
  selectedProfile,
  examples,
  isLoadingProfiles,
  isLoadingExamples,
  isCreatingProfile,
  isAddingExample,
  error,
  onSelectProfile,
  onCreateProfile,
  onAddExample,
}: ProfileWorkspaceProps) {
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [sourceType, setSourceType] =
    useState<ExampleClipSourceType>("TWITCH_CLIP_URL");
  const [sourceValue, setSourceValue] = useState("");
  const [exampleTitle, setExampleTitle] = useState("");
  const [exampleNote, setExampleNote] = useState("");

  const visibleExamples =
    examples.length > 0 || isLoadingExamples
      ? examples
      : (selectedProfile?.exampleClips ?? []);
  const selectedSourceType = sourceTypeOptions.find(
    (option) => option.id === sourceType,
  );
  const usesLocalFilePicker =
    sourceType === "LOCAL_FILE_UPLOAD" || sourceType === "LOCAL_FILE_PATH";

  async function handlePickLocalExample(nextSourceType: ExampleClipSourceType) {
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
        setSourceType(nextSourceType);
        setSourceValue(selection);
      }
    } catch {
      setSourceType(nextSourceType);
    }
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
              <span className="detail-label">Profile examples</span>
              <h2>Saved example references</h2>
            </div>
            {isLoadingExamples ? (
              <span className="queue-count">Refreshing…</span>
            ) : null}
          </div>

          {error ? <p className="analysis-error">{error}</p> : null}

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

function formatStatus(status: ExampleClip["status"]): string {
  if (status === "LOCAL_FILE_AVAILABLE") {
    return "Local file found";
  }

  if (status === "MISSING_LOCAL_FILE") {
    return "Path missing";
  }

  return "Reference only";
}

function formatTopReasons(
  reasonCodes: NonNullable<ExampleClip["featureSummary"]>["topReasonCodes"],
) {
  if (!reasonCodes || reasonCodes.length === 0) {
    return "none yet";
  }

  return reasonCodes.join(", ");
}

function formatTranscriptAnchors(
  terms: NonNullable<ExampleClip["featureSummary"]>["transcriptAnchorTerms"],
) {
  if (!terms || terms.length === 0) {
    return "none yet";
  }

  return terms.slice(0, 3).join(", ");
}
