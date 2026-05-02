import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type SurfaceCardProps = {
  eyebrow?: string;
  title?: string;
  accent?: "cyan" | "magenta" | "violet";
  children: ReactNode;
};

const accentStyles = StyleSheet.create({
  cyan: {
    borderColor: "rgba(66, 173, 230, 0.3)",
  },
  magenta: {
    borderColor: "rgba(201, 63, 215, 0.3)",
  },
  violet: {
    borderColor: "rgba(126, 101, 255, 0.28)",
  },
});

export function SurfaceCard({
  eyebrow,
  title,
  accent = "magenta",
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
    backgroundColor: "rgba(8, 10, 28, 0.9)",
  },
  eyebrow: {
    color: "#62d9ff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#f8fbff",
    fontSize: 19,
    fontWeight: "700",
  },
});
