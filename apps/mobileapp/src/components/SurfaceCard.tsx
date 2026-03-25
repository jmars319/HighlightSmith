import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type SurfaceCardProps = {
  eyebrow?: string;
  title?: string;
  accent?: "amber" | "teal" | "rose";
  children: ReactNode;
};

const accentStyles = StyleSheet.create({
  amber: {
    borderColor: "rgba(244, 176, 97, 0.28)",
  },
  teal: {
    borderColor: "rgba(106, 186, 193, 0.28)",
  },
  rose: {
    borderColor: "rgba(225, 125, 120, 0.28)",
  },
});

export function SurfaceCard({
  eyebrow,
  title,
  accent = "amber",
  children,
}: SurfaceCardProps) {
  return (
    <View style={[styles.card, accentStyles[accent]]}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: "rgba(17, 23, 28, 0.88)",
  },
  eyebrow: {
    color: "#f4b061",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#f8f2e9",
    fontSize: 19,
    fontWeight: "700",
  },
});
