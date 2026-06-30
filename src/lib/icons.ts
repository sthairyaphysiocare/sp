import {
  Activity, HeartPulse, Dumbbell, Stethoscope, Bone, Brain, Baby, Footprints,
  ShieldCheck, Sparkles, Feather, Sun, Award, GraduationCap, Clock, User,
  PersonStanding, Bandage, ClipboardList, UserCheck, TrendingUp, LineChart,
  Pill, Syringe, Hand, Accessibility, Hospital, FirstAid, Cross, Microscope,
  Thermometer, Pulse, Zap, Smile, EyeOff, Eye, Waves, Wind, Snowflake, Flame,
  Target, Crosshair, Compass, Leaf, Droplet, BatteryCharging, Gauge, Backpack,
  Bike, Mountain, Trees, type LucideIcon,
} from "lucide-react";

// Some lucide versions don't export Pulse / FirstAid; safe fallbacks
const SafePulse = (Pulse as LucideIcon | undefined) ?? HeartPulse;
const SafeFirstAid = (FirstAid as LucideIcon | undefined) ?? Cross;

export const ICON_MAP: Record<string, LucideIcon> = {
  Activity, HeartPulse, Dumbbell, Stethoscope, Bone, Brain, Baby, Footprints,
  ShieldCheck, Sparkles, Feather, Sun, Award, GraduationCap, Clock, User,
  PersonStanding, Bandage, ClipboardList, UserCheck, TrendingUp, LineChart,
  Pill, Syringe, Hand, Accessibility, Hospital, FirstAid: SafeFirstAid, Cross, Microscope,
  Thermometer, Pulse: SafePulse, Zap, Smile, EyeOff, Eye, Waves, Wind, Snowflake, Flame,
  Target, Crosshair, Compass, Leaf, Droplet, BatteryCharging, Gauge, Backpack,
  Bike, Mountain, Trees,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

export function getIcon(name?: string): LucideIcon {
  if (!name) return Activity;
  return ICON_MAP[name] ?? Activity;
}
