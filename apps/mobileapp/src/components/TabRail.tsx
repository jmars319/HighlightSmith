import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileTab } from "../data/companion";

type TabRailProps = {
  activeTab: MobileTab;
  onSelect: (tab: MobileTab) => void;
  tabs: Array<{ id: MobileTab; label: string }>;
};

export function TabRail({ activeTab, onSelect, tabs }: TabRailProps) {
  return (
    <View style={styles.rail}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={[styles.tab, isActive ? styles.activeTab : null]}
          >
            <Text style={[styles.label, isActive ? styles.activeLabel : null]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
    padding: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(13, 18, 23, 0.94)",
  },
  tab: {
    flexGrow: 1,
    minWidth: 86,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  activeTab: {
    backgroundColor: "rgba(244, 176, 97, 0.16)",
  },
  label: {
    color: "rgba(248, 242, 233, 0.7)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  activeLabel: {
    color: "#ffd8a9",
  },
});
