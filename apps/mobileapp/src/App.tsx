import { StatusBar } from "expo-status-bar";
import { startTransition, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SurfaceCard } from "./components/SurfaceCard";
import { TabRail } from "./components/TabRail";
import {
  bandTone,
  companionSnapshot,
  mobileTabs,
  type MobileTab,
} from "./data/companion";

const pulseLogo = require("../assets/vaexcore-pulse-logo.png") as number;

export default function App() {
  const [activeTab, setActiveTab] = useState<MobileTab>("dashboard");

  function renderTabContent() {
    if (activeTab === "projects") {
      return (
        <View style={styles.sectionStack}>
          {companionSnapshot.projects.length === 0 ? (
            <SurfaceCard
              accent="teal"
              eyebrow="Projects"
              title="No synced sessions yet"
            >
              <Text style={styles.bodyText}>
                This companion surface stays empty until a real mobile sync path
                exists.
              </Text>
            </SurfaceCard>
          ) : null}
          {companionSnapshot.projects.map((project) => (
            <SurfaceCard
              accent="teal"
              eyebrow={`Profile: ${project.profileLabel}`}
              key={project.sessionId}
              title={project.sessionTitle}
            >
              <Text style={styles.bodyText}>
                {project.candidateCount} candidates tracked,{" "}
                {project.acceptedCount} accepted.
              </Text>
              <Text style={styles.mutedText}>{project.sourcePath}</Text>
              <Text style={styles.captionText}>
                Companion use case: quick project browsing and status checks.
              </Text>
              <Text style={styles.metaText}>
                Updated {project.updatedLabel}
              </Text>
            </SurfaceCard>
          ))}
        </View>
      );
    }

    if (activeTab === "queue") {
      return (
        <View style={styles.sectionStack}>
          <SurfaceCard
            accent="amber"
            eyebrow="Candidate Queue"
            title="Read-only review backlog"
          >
            <Text style={styles.bodyText}>
              Mobile can surface queue pressure and context, but review
              authority should stay desktop-first until real persistence and
              sync exist.
            </Text>
          </SurfaceCard>

          {companionSnapshot.queue.length === 0 ? (
            <SurfaceCard
              accent="amber"
              eyebrow="Candidate Queue"
              title="No synced queue items"
            >
              <Text style={styles.bodyText}>
                Mobile does not invent review backlog items. Real queue data has
                not been connected here yet.
              </Text>
            </SurfaceCard>
          ) : null}

          {companionSnapshot.queue.map((candidate) => {
            const tone = bandTone(candidate.confidenceBand);

            return (
              <SurfaceCard key={candidate.id} title={candidate.label}>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaText}>{candidate.windowLabel}</Text>
                  <View
                    style={[
                      styles.bandChip,
                      { backgroundColor: tone.backgroundColor },
                    ]}
                  >
                    <Text
                      style={[styles.bandChipLabel, { color: tone.textColor }]}
                    >
                      {tone.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bodyText}>
                  {candidate.transcriptSnippet}
                </Text>
                <Text style={styles.captionText}>
                  {candidate.reasonSummary}
                </Text>
              </SurfaceCard>
            );
          })}
        </View>
      );
    }

    if (activeTab === "clips") {
      return (
        <View style={styles.sectionStack}>
          <SurfaceCard
            accent="teal"
            eyebrow="Accepted Clips"
            title="Approved moments only"
          >
            <Text style={styles.bodyText}>
              This companion surface is useful once desktop review decisions are
              worth checking away from the workstation.
            </Text>
          </SurfaceCard>

          {companionSnapshot.acceptedClips.length === 0 ? (
            <SurfaceCard
              accent="teal"
              eyebrow="Accepted Clips"
              title="No accepted clips synced"
            >
              <Text style={styles.bodyText}>
                Approved clips will appear here only when real review decisions
                are connected to mobile.
              </Text>
            </SurfaceCard>
          ) : null}

          {companionSnapshot.acceptedClips.map((clip) => {
            const tone = bandTone(clip.confidenceBand);

            return (
              <SurfaceCard key={clip.id} title={clip.label}>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaText}>{clip.segmentLabel}</Text>
                  <View
                    style={[
                      styles.bandChip,
                      { backgroundColor: tone.backgroundColor },
                    ]}
                  >
                    <Text
                      style={[styles.bandChipLabel, { color: tone.textColor }]}
                    >
                      {tone.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.bodyText}>{clip.transcriptSnippet}</Text>
              </SurfaceCard>
            );
          })}
        </View>
      );
    }

    if (activeTab === "profiles") {
      return (
        <View style={styles.sectionStack}>
          <SurfaceCard
            accent="rose"
            eyebrow="Profiles"
            title="Visibility, not tuning"
          >
            <Text style={styles.bodyText}>
              Mobile can expose active profile intent and settings later, but it
              should not become the place where analysis behavior is authored.
            </Text>
          </SurfaceCard>

          {companionSnapshot.profiles.length === 0 ? (
            <SurfaceCard
              accent="rose"
              eyebrow="Profiles"
              title="No synced profiles yet"
            >
              <Text style={styles.bodyText}>
                Profile data should come from persisted storage, not placeholder
                mobile presets.
              </Text>
            </SurfaceCard>
          ) : null}

          {companionSnapshot.profiles.map((profile) => (
            <SurfaceCard
              accent="rose"
              eyebrow={profile.mode}
              key={profile.id}
              title={profile.label}
            >
              <Text style={styles.bodyText}>{profile.description}</Text>
              <Text style={styles.metaText}>
                {profile.weightCount} signal weights scaffolded
              </Text>
            </SurfaceCard>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.sectionStack}>
        <SurfaceCard
          accent="amber"
          eyebrow="Companion Status"
          title="Thin mobile boundary"
        >
          <Text style={styles.bodyText}>
            {companionSnapshot.dashboard.statusLabel}
          </Text>
          <Text style={styles.captionText}>
            {companionSnapshot.dashboard.surfaceNote}
          </Text>
        </SurfaceCard>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="Projects"
            value={String(companionSnapshot.dashboard.projectCount)}
          />
          <MetricCard
            label="Pending"
            value={String(companionSnapshot.dashboard.pendingCount)}
          />
          <MetricCard
            label="Accepted"
            value={String(companionSnapshot.dashboard.acceptedCount)}
          />
          <MetricCard
            label="Profiles"
            value={String(companionSnapshot.dashboard.profileCount)}
          />
        </View>

        <SurfaceCard
          accent="teal"
          eyebrow="Primary Project"
          title={companionSnapshot.dashboard.primaryProjectTitle}
        >
          <Text style={styles.bodyText}>
            Active companion profile:{" "}
            {companionSnapshot.dashboard.primaryProfileLabel}
          </Text>
          <Text style={styles.metaText}>
            Updated {companionSnapshot.dashboard.lastUpdatedLabel}
          </Text>
        </SurfaceCard>

        <SurfaceCard
          accent="rose"
          eyebrow="Out Of Scope"
          title="Keep mobile honest"
        >
          {companionSnapshot.guardrails.map((item) => (
            <Text key={item} style={styles.listItem}>
              - {item}
            </Text>
          ))}
        </SurfaceCard>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.orb, styles.orbLeft]} />
      <View style={[styles.orb, styles.orbRight]} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            accessibilityLabel="vaexcore pulse logo"
            resizeMode="cover"
            source={pulseLogo}
            style={styles.logo}
          />
          <Text style={styles.kicker}>vaexcore pulse companion</Text>
          <Text style={styles.title}>
            Browse the queue without pretending to run the workstation.
          </Text>
          <Text style={styles.subtitle}>
            Companion management surface for projects, candidate status, and
            accepted clips. Local ingest, analysis, and editorial control still
            belong to desktop.
          </Text>
        </View>

        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Early scaffold only</Text>
        </View>

        {renderTabContent()}

        <TabRail
          activeTab={activeTab}
          onSelect={(tab) => {
            startTransition(() => {
              setActiveTab(tab);
            });
          }}
          tabs={mobileTabs}
        />
      </ScrollView>
    </View>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b1115",
  },
  scrollContent: {
    gap: 18,
    paddingTop: 72,
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.34,
  },
  orbLeft: {
    top: 70,
    left: -70,
    width: 220,
    height: 220,
    backgroundColor: "#ef9b55",
  },
  orbRight: {
    top: 260,
    right: -90,
    width: 260,
    height: 260,
    backgroundColor: "#4d8faa",
  },
  header: {
    gap: 10,
  },
  logo: {
    width: 86,
    height: 86,
    borderRadius: 8,
  },
  kicker: {
    color: "#f4b061",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#f9f4eb",
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(249, 244, 235, 0.74)",
    fontSize: 15,
    lineHeight: 22,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(93, 168, 182, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(93, 168, 182, 0.26)",
  },
  statusPillText: {
    color: "#a9dde0",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionStack: {
    gap: 14,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 145,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(17, 23, 28, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  metricLabel: {
    color: "rgba(249, 244, 235, 0.62)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metricValue: {
    marginTop: 8,
    color: "#f9f4eb",
    fontSize: 26,
    fontWeight: "700",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  bandChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  bandChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  bodyText: {
    color: "#f8f2e9",
    fontSize: 15,
    lineHeight: 22,
  },
  mutedText: {
    color: "rgba(248, 242, 233, 0.66)",
    fontSize: 13,
    lineHeight: 19,
  },
  captionText: {
    color: "#d6c8b4",
    fontSize: 13,
    lineHeight: 19,
  },
  metaText: {
    color: "rgba(248, 242, 233, 0.58)",
    fontSize: 12,
    fontWeight: "600",
  },
  listItem: {
    color: "#f8f2e9",
    fontSize: 14,
    lineHeight: 21,
  },
});
