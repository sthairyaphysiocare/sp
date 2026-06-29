import {
  Activity, HeartPulse, Dumbbell, Stethoscope, Bone, Brain, Baby, Footprints,
  ShieldCheck, Sparkles, Feather, Sun, Award, GraduationCap, Clock, User,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Activity, HeartPulse, Dumbbell, Stethoscope, Bone, Brain, Baby, Footprints,
  ShieldCheck, Sparkles, Feather, Sun, Award, GraduationCap, Clock, User,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

export function getIcon(name?: string): LucideIcon {
  if (!name) return Activity;
  return ICON_MAP[name] ?? Activity;
}
