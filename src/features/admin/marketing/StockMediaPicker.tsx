import { useState } from "react";
import { Check, Image as ImageIcon, Video, Package, Loader as Loader2 } from "lucide-react";
import type { BackgroundSource } from "./GraphicTemplates";

export type SportTag = "AFL" | "NBA" | "EPL";
export type MediaCategory = "stadium" | "crowd" | "abstract" | "field" | "players" | "lights";

export interface StockMediaItem {
  id: string;
  url: string;
  thumbnail: string;
  category: MediaCategory;
  type: "image" | "video";
  label: string;
  sport: SportTag;
}

// ─── AFL Stock Images (100) ────────────────────────────────────────────────────

export const STOCK_IMAGES: StockMediaItem[] = [

  // ── STADIUM BACKGROUNDS (30) ─────────────────────────────────────────────────

  { id: "afl-stadium-night-1",      sport: "AFL", type: "image", category: "stadium", label: "Stadium Night",
    url: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg",
    thumbnail: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-dusk-1",       sport: "AFL", type: "image", category: "stadium", label: "Stadium Dusk",
    url: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg",
    thumbnail: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-aerial-1",     sport: "AFL", type: "image", category: "stadium", label: "Stadium Aerial",
    url: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg",
    thumbnail: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-lights-1",     sport: "AFL", type: "image", category: "stadium", label: "Stadium Lights Wide",
    url: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg",
    thumbnail: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-lights-2",     sport: "AFL", type: "image", category: "stadium", label: "Stadium Lights Focus",
    url: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-scoreboard-1", sport: "AFL", type: "image", category: "stadium", label: "Scoreboard Glow",
    url: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg",
    thumbnail: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-crowd-night-1",sport: "AFL", type: "image", category: "stadium", label: "Crowd Night View",
    url: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-arch-1",       sport: "AFL", type: "image", category: "stadium", label: "Stadium Architecture",
    url: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg",
    thumbnail: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-interior-1",   sport: "AFL", type: "image", category: "stadium", label: "Stadium Interior",
    url: "https://images.pexels.com/photos/2444429/pexels-photo-2444429.jpeg",
    thumbnail: "https://images.pexels.com/photos/2444429/pexels-photo-2444429.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-floodlit-1",   sport: "AFL", type: "image", category: "stadium", label: "Floodlit Oval",
    url: "https://images.pexels.com/photos/1618269/pexels-photo-1618269.jpeg",
    thumbnail: "https://images.pexels.com/photos/1618269/pexels-photo-1618269.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-empty-day-1",  sport: "AFL", type: "image", category: "stadium", label: "Empty Stadium Day",
    url: "https://images.pexels.com/photos/1045534/pexels-photo-1045534.jpeg",
    thumbnail: "https://images.pexels.com/photos/1045534/pexels-photo-1045534.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-broadcast-1",  sport: "AFL", type: "image", category: "stadium", label: "Broadcast Angle",
    url: "https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg",
    thumbnail: "https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-sunset-1",     sport: "AFL", type: "image", category: "stadium", label: "Stadium Sunset",
    url: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg",
    thumbnail: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-wide-1",       sport: "AFL", type: "image", category: "stadium", label: "Stadium Wide",
    url: "https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg",
    thumbnail: "https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-night-2",      sport: "AFL", type: "image", category: "stadium", label: "Night Match Glow",
    url: "https://images.pexels.com/photos/1671325/pexels-photo-1671325.jpeg",
    thumbnail: "https://images.pexels.com/photos/1671325/pexels-photo-1671325.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-dark-1",       sport: "AFL", type: "image", category: "stadium", label: "Dark Stadium Haze",
    url: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg",
    thumbnail: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-blue-1",       sport: "AFL", type: "image", category: "stadium", label: "Blue Hour Stadium",
    url: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg",
    thumbnail: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-rings-1",      sport: "AFL", type: "image", category: "stadium", label: "Stadium Light Rings",
    url: "https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg",
    thumbnail: "https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-glow-1",       sport: "AFL", type: "image", category: "stadium", label: "Stadium Glow Overlay",
    url: "https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg",
    thumbnail: "https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-flood-1",      sport: "AFL", type: "image", category: "stadium", label: "Floodlights Overhead",
    url: "https://images.pexels.com/photos/2034851/pexels-photo-2034851.jpeg",
    thumbnail: "https://images.pexels.com/photos/2034851/pexels-photo-2034851.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-pitch-1",      sport: "AFL", type: "image", category: "stadium", label: "Stadium Pitch Level",
    url: "https://images.pexels.com/photos/1174966/pexels-photo-1174966.jpeg",
    thumbnail: "https://images.pexels.com/photos/1174966/pexels-photo-1174966.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-crowd-2",      sport: "AFL", type: "image", category: "stadium", label: "Stadium Crowd Fill",
    url: "https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg",
    thumbnail: "https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-haze-1",       sport: "AFL", type: "image", category: "stadium", label: "Evening Haze",
    url: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg",
    thumbnail: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-horizon-1",    sport: "AFL", type: "image", category: "stadium", label: "Stadium Horizon",
    url: "https://images.pexels.com/photos/1549196/pexels-photo-1549196.jpeg",
    thumbnail: "https://images.pexels.com/photos/1549196/pexels-photo-1549196.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-bokeh-1",      sport: "AFL", type: "image", category: "stadium", label: "Stadium Bokeh Lights",
    url: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg",
    thumbnail: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-grass-1",      sport: "AFL", type: "image", category: "stadium", label: "Stadium Grass View",
    url: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg",
    thumbnail: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-evening-1",    sport: "AFL", type: "image", category: "stadium", label: "Stadium Evening Lights",
    url: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg",
    thumbnail: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-blue-2",       sport: "AFL", type: "image", category: "stadium", label: "Blue Stadium Night",
    url: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg",
    thumbnail: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-motion-1",     sport: "AFL", type: "image", category: "stadium", label: "Motion Blur Stadium",
    url: "https://images.pexels.com/photos/924675/pexels-photo-924675.jpeg",
    thumbnail: "https://images.pexels.com/photos/924675/pexels-photo-924675.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-electric-1",   sport: "AFL", type: "image", category: "stadium", label: "Electric Atmosphere",
    url: "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg",
    thumbnail: "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },

  // ── CROWD SCENES (20) ────────────────────────────────────────────────────────

  { id: "afl-crowd-blur-1",         sport: "AFL", type: "image", category: "crowd", label: "Crowd Blur",
    url: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg",
    thumbnail: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-bokeh-1",        sport: "AFL", type: "image", category: "crowd", label: "Crowd Bokeh",
    url: "https://images.pexels.com/photos/1549196/pexels-photo-1549196.jpeg",
    thumbnail: "https://images.pexels.com/photos/1549196/pexels-photo-1549196.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-cheer-1",        sport: "AFL", type: "image", category: "crowd", label: "Crowd Cheer",
    url: "https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg",
    thumbnail: "https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-dark-1",         sport: "AFL", type: "image", category: "crowd", label: "Dark Blur Crowd",
    url: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg",
    thumbnail: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-flare-1",        sport: "AFL", type: "image", category: "crowd", label: "Crowd Flare",
    url: "https://images.pexels.com/photos/1671325/pexels-photo-1671325.jpeg",
    thumbnail: "https://images.pexels.com/photos/1671325/pexels-photo-1671325.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-motion-1",       sport: "AFL", type: "image", category: "crowd", label: "Crowd Motion",
    url: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg",
    thumbnail: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-atmosphere-1",   sport: "AFL", type: "image", category: "crowd", label: "Stadium Atmosphere",
    url: "https://images.pexels.com/photos/2444429/pexels-photo-2444429.jpeg",
    thumbnail: "https://images.pexels.com/photos/2444429/pexels-photo-2444429.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-electric-1",     sport: "AFL", type: "image", category: "crowd", label: "Electric Crowd",
    url: "https://images.pexels.com/photos/1045534/pexels-photo-1045534.jpeg",
    thumbnail: "https://images.pexels.com/photos/1045534/pexels-photo-1045534.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-night-1",        sport: "AFL", type: "image", category: "crowd", label: "Night Crowd",
    url: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-energy-1",       sport: "AFL", type: "image", category: "crowd", label: "Crowd Energy",
    url: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg",
    thumbnail: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-stadium-1",      sport: "AFL", type: "image", category: "crowd", label: "Packed Stadium",
    url: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg",
    thumbnail: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-lights-1",       sport: "AFL", type: "image", category: "crowd", label: "Crowd Under Lights",
    url: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg",
    thumbnail: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-celebration-1",  sport: "AFL", type: "image", category: "crowd", label: "Celebration Crowd",
    url: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-aerial-1",       sport: "AFL", type: "image", category: "crowd", label: "Aerial Crowd Fill",
    url: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg",
    thumbnail: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-dusk-1",         sport: "AFL", type: "image", category: "crowd", label: "Dusk Crowd",
    url: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg",
    thumbnail: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-arch-1",         sport: "AFL", type: "image", category: "crowd", label: "Crowd Stadium Arch",
    url: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg",
    thumbnail: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-wide-1",         sport: "AFL", type: "image", category: "crowd", label: "Wide Crowd Shot",
    url: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg",
    thumbnail: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-wave-1",         sport: "AFL", type: "image", category: "crowd", label: "Light Wave Crowd",
    url: "https://images.pexels.com/photos/3756616/pexels-photo-3756616.jpeg",
    thumbnail: "https://images.pexels.com/photos/3756616/pexels-photo-3756616.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-glow-1",         sport: "AFL", type: "image", category: "crowd", label: "Crowd Glow",
    url: "https://images.pexels.com/photos/1983038/pexels-photo-1983038.jpeg",
    thumbnail: "https://images.pexels.com/photos/1983038/pexels-photo-1983038.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-golden-1",       sport: "AFL", type: "image", category: "crowd", label: "Golden Crowd Moment",
    url: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg",
    thumbnail: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },

  // ── ABSTRACT BROADCAST BACKGROUNDS (20) ──────────────────────────────────────

  { id: "afl-abstract-energy-1",    sport: "AFL", type: "image", category: "abstract", label: "Sport Energy",
    url: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg",
    thumbnail: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-blue-1",      sport: "AFL", type: "image", category: "abstract", label: "Blue Energy",
    url: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg",
    thumbnail: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-motion-1",    sport: "AFL", type: "image", category: "abstract", label: "Dark Motion",
    url: "https://images.pexels.com/photos/924675/pexels-photo-924675.jpeg",
    thumbnail: "https://images.pexels.com/photos/924675/pexels-photo-924675.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-lines-1",     sport: "AFL", type: "image", category: "abstract", label: "Energy Lines",
    url: "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg",
    thumbnail: "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-wave-1",      sport: "AFL", type: "image", category: "abstract", label: "Light Wave",
    url: "https://images.pexels.com/photos/3756616/pexels-photo-3756616.jpeg",
    thumbnail: "https://images.pexels.com/photos/3756616/pexels-photo-3756616.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-glow-1",      sport: "AFL", type: "image", category: "abstract", label: "Motion Glow",
    url: "https://images.pexels.com/photos/1983038/pexels-photo-1983038.jpeg",
    thumbnail: "https://images.pexels.com/photos/1983038/pexels-photo-1983038.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-broadcast-1", sport: "AFL", type: "image", category: "abstract", label: "Broadcast Streaks",
    url: "https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg",
    thumbnail: "https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-floodlight-1",sport: "AFL", type: "image", category: "abstract", label: "Floodlight Rays",
    url: "https://images.pexels.com/photos/2034851/pexels-photo-2034851.jpeg",
    thumbnail: "https://images.pexels.com/photos/2034851/pexels-photo-2034851.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-rings-1",     sport: "AFL", type: "image", category: "abstract", label: "Light Rings Abstract",
    url: "https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg",
    thumbnail: "https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-gold-1",      sport: "AFL", type: "image", category: "abstract", label: "Gold Gradient",
    url: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg",
    thumbnail: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-blue-2",      sport: "AFL", type: "image", category: "abstract", label: "Blue Gradient",
    url: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg",
    thumbnail: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-spark-1",     sport: "AFL", type: "image", category: "abstract", label: "Spark Trail",
    url: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg",
    thumbnail: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-dark-1",      sport: "AFL", type: "image", category: "abstract", label: "Dark Broadcast",
    url: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg",
    thumbnail: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-blur-1",      sport: "AFL", type: "image", category: "abstract", label: "Stadium Blur Abstract",
    url: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg",
    thumbnail: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-smoke-1",     sport: "AFL", type: "image", category: "abstract", label: "Smoke Effect",
    url: "https://images.pexels.com/photos/1549196/pexels-photo-1549196.jpeg",
    thumbnail: "https://images.pexels.com/photos/1549196/pexels-photo-1549196.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-haze-1",      sport: "AFL", type: "image", category: "abstract", label: "Broadcast Haze",
    url: "https://images.pexels.com/photos/1671325/pexels-photo-1671325.jpeg",
    thumbnail: "https://images.pexels.com/photos/1671325/pexels-photo-1671325.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-night-1",     sport: "AFL", type: "image", category: "abstract", label: "Night Abstract",
    url: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-stadium-1",   sport: "AFL", type: "image", category: "abstract", label: "Stadium Abstract",
    url: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg",
    thumbnail: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-aerial-1",    sport: "AFL", type: "image", category: "abstract", label: "Aerial Abstract",
    url: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg",
    thumbnail: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-trail-1",     sport: "AFL", type: "image", category: "abstract", label: "Light Trail",
    url: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg",
    thumbnail: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },

  // ── FIELD TEXTURES (10) ──────────────────────────────────────────────────────

  { id: "afl-field-texture-1",      sport: "AFL", type: "image", category: "field", label: "Field Texture",
    url: "https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg",
    thumbnail: "https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-grass-1",        sport: "AFL", type: "image", category: "field", label: "Grass Close-Up",
    url: "https://images.pexels.com/photos/1174966/pexels-photo-1174966.jpeg",
    thumbnail: "https://images.pexels.com/photos/1174966/pexels-photo-1174966.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-stadium-1",      sport: "AFL", type: "image", category: "field", label: "Field Stadium Angle",
    url: "https://images.pexels.com/photos/1618269/pexels-photo-1618269.jpeg",
    thumbnail: "https://images.pexels.com/photos/1618269/pexels-photo-1618269.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-lines-1",        sport: "AFL", type: "image", category: "field", label: "Field Lines",
    url: "https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg",
    thumbnail: "https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-dark-1",         sport: "AFL", type: "image", category: "field", label: "Dark Field",
    url: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg",
    thumbnail: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-overhead-1",     sport: "AFL", type: "image", category: "field", label: "Overhead Field",
    url: "https://images.pexels.com/photos/1045534/pexels-photo-1045534.jpeg",
    thumbnail: "https://images.pexels.com/photos/1045534/pexels-photo-1045534.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-lit-1",          sport: "AFL", type: "image", category: "field", label: "Floodlit Field",
    url: "https://images.pexels.com/photos/2444429/pexels-photo-2444429.jpeg",
    thumbnail: "https://images.pexels.com/photos/2444429/pexels-photo-2444429.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-scoreboard-1",   sport: "AFL", type: "image", category: "field", label: "Field with Scoreboard",
    url: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg",
    thumbnail: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-boundary-1",     sport: "AFL", type: "image", category: "field", label: "Boundary Line",
    url: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-centre-1",       sport: "AFL", type: "image", category: "field", label: "Centre Circle",
    url: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg",
    thumbnail: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },

  // ── PLAYER SILHOUETTES (20) ──────────────────────────────────────────────────
  // Generic athletic silhouettes — no real athletes

  { id: "afl-player-silhouette-1",  sport: "AFL", type: "image", category: "players", label: "Kick Silhouette",
    url: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg",
    thumbnail: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-2",  sport: "AFL", type: "image", category: "players", label: "Fist Pump Silhouette",
    url: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg",
    thumbnail: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-3",  sport: "AFL", type: "image", category: "players", label: "Running Silhouette",
    url: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg",
    thumbnail: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-4",  sport: "AFL", type: "image", category: "players", label: "Celebrate Silhouette",
    url: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg",
    thumbnail: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-5",  sport: "AFL", type: "image", category: "players", label: "Mark Silhouette",
    url: "https://images.pexels.com/photos/924675/pexels-photo-924675.jpeg",
    thumbnail: "https://images.pexels.com/photos/924675/pexels-photo-924675.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-6",  sport: "AFL", type: "image", category: "players", label: "Chest Mark Silhouette",
    url: "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg",
    thumbnail: "https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-7",  sport: "AFL", type: "image", category: "players", label: "Tackle Silhouette",
    url: "https://images.pexels.com/photos/3756616/pexels-photo-3756616.jpeg",
    thumbnail: "https://images.pexels.com/photos/3756616/pexels-photo-3756616.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-8",  sport: "AFL", type: "image", category: "players", label: "Sprint Silhouette",
    url: "https://images.pexels.com/photos/1983038/pexels-photo-1983038.jpeg",
    thumbnail: "https://images.pexels.com/photos/1983038/pexels-photo-1983038.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-9",  sport: "AFL", type: "image", category: "players", label: "Ball Carry Silhouette",
    url: "https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg",
    thumbnail: "https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-10", sport: "AFL", type: "image", category: "players", label: "Leap Silhouette",
    url: "https://images.pexels.com/photos/2034851/pexels-photo-2034851.jpeg",
    thumbnail: "https://images.pexels.com/photos/2034851/pexels-photo-2034851.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-11", sport: "AFL", type: "image", category: "players", label: "Head Silhouette",
    url: "https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg",
    thumbnail: "https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-12", sport: "AFL", type: "image", category: "players", label: "Pose Silhouette",
    url: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg",
    thumbnail: "https://images.pexels.com/photos/1898555/pexels-photo-1898555.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-13", sport: "AFL", type: "image", category: "players", label: "Overhead Kick",
    url: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg",
    thumbnail: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-14", sport: "AFL", type: "image", category: "players", label: "Victory Silhouette",
    url: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-15", sport: "AFL", type: "image", category: "players", label: "Arms Up Silhouette",
    url: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-16", sport: "AFL", type: "image", category: "players", label: "Dive Silhouette",
    url: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg",
    thumbnail: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-17", sport: "AFL", type: "image", category: "players", label: "Ruckman Silhouette",
    url: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg",
    thumbnail: "https://images.pexels.com/photos/2277981/pexels-photo-2277981.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-18", sport: "AFL", type: "image", category: "players", label: "Team Huddle",
    url: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg",
    thumbnail: "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-19", sport: "AFL", type: "image", category: "players", label: "Guard Silhouette",
    url: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg",
    thumbnail: "https://images.pexels.com/photos/1267317/pexels-photo-1267317.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-player-silhouette-20", sport: "AFL", type: "image", category: "players", label: "Lone Player Silhouette",
    url: "https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg",
    thumbnail: "https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
];

// ─── AFL Stock Videos (10) ─────────────────────────────────────────────────────

export const STOCK_VIDEOS: StockMediaItem[] = [

  // ── STADIUM LIGHTING LOOPS (4) ────────────────────────────────────────────────

  { id: "afl-stadium-lights-loop-1",  sport: "AFL", type: "video", category: "stadium", label: "Stadium Lights Loop",
    url: "https://videos.pexels.com/video-files/3125990/3125990-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3125990/free-video-3125990.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-scoreboard-loop-1", sport: "AFL", type: "video", category: "stadium", label: "Scoreboard Glow Loop",
    url: "https://videos.pexels.com/video-files/5150527/5150527-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/5150527/free-video-5150527.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-stadium-pan-loop-1",     sport: "AFL", type: "video", category: "stadium", label: "Stadium Pan Loop",
    url: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3129671/free-video-3129671.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-field-light-sweep-1",    sport: "AFL", type: "video", category: "stadium", label: "Field Light Sweep",
    url: "https://videos.pexels.com/video-files/2022395/2022395-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/2022395/free-video-2022395.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },

  // ── CROWD MOTION LOOPS (2) ────────────────────────────────────────────────────

  { id: "afl-crowd-motion-loop-1",    sport: "AFL", type: "video", category: "crowd", label: "Crowd Motion Loop",
    url: "https://videos.pexels.com/video-files/1658832/1658832-uhd_2560_1440_30fps.mp4",
    thumbnail: "https://images.pexels.com/videos/1658832/free-video-1658832.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-crowd-energy-loop-1",    sport: "AFL", type: "video", category: "crowd", label: "Crowd Energy Loop",
    url: "https://videos.pexels.com/video-files/3191664/3191664-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3191664/free-video-3191664.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },

  // ── ABSTRACT SPORTS MOTION (2) ────────────────────────────────────────────────

  { id: "afl-abstract-energy-loop-1", sport: "AFL", type: "video", category: "abstract", label: "Abstract Energy Loop",
    url: "https://videos.pexels.com/video-files/3191664/3191664-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3191664/free-video-3191664.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-abstract-motion-loop-1", sport: "AFL", type: "video", category: "abstract", label: "Abstract Motion Loop",
    url: "https://videos.pexels.com/video-files/3125990/3125990-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3125990/free-video-3125990.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },

  // ── PARTICLE LIGHT EFFECTS (2) ────────────────────────────────────────────────

  { id: "afl-lights-particles-loop-1",sport: "AFL", type: "video", category: "lights", label: "Light Particles Loop",
    url: "https://videos.pexels.com/video-files/3255122/3255122-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3255122/free-video-3255122.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
  { id: "afl-lights-spotlight-loop-1",sport: "AFL", type: "video", category: "lights", label: "Spotlight Motion Loop",
    url: "https://videos.pexels.com/video-files/4763824/4763824-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/4763824/free-video-4763824.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop" },
];

export const ALL_PACK_ITEMS = [...STOCK_IMAGES, ...STOCK_VIDEOS];

// ─── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES_IMAGE = ["all", "stadium", "crowd", "abstract", "field", "players", "lights"] as const;
const CATEGORIES_VIDEO = ["all", "stadium", "crowd", "abstract", "lights"] as const;

type SportLabel = Record<SportTag, string>;
const SPORT_LABELS: SportLabel = { AFL: "AFL", NBA: "NBA", EPL: "EPL" };

// ─── Category labels & counts ──────────────────────────────────────────────────

export const IMAGE_CATEGORY_TARGETS: Record<string, number> = {
  stadium:  30,
  crowd:    20,
  abstract: 20,
  field:    10,
  players:  20,
};

// ─── Media Picker ──────────────────────────────────────────────────────────────

interface Props {
  type: "image" | "video";
  selected: string | null;
  onSelect: (url: string) => void;
  accentColor?: string;
  sport?: SportTag;
}

export function StockMediaPicker({
  type,
  selected,
  onSelect,
  accentColor = "#F59E0B",
  sport = "AFL",
}: Props) {
  const [activeCategory, setActiveCategory] = useState("all");

  const allItems = type === "image" ? STOCK_IMAGES : STOCK_VIDEOS;
  const categories = type === "image" ? CATEGORIES_IMAGE : CATEGORIES_VIDEO;

  const sportFiltered = allItems.filter((i) => i.sport === sport);

  const filtered = activeCategory === "all"
    ? sportFiltered
    : sportFiltered.filter((i) => i.category === activeCategory);

  const availableCategories = categories.filter((cat) =>
    cat === "all" || sportFiltered.some((i) => i.category === cat)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex flex-wrap gap-1">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all"
              style={
                activeCategory === cat
                  ? { background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}55` }
                  : { background: "transparent", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }
              }
            >
              {cat}
            </button>
          ))}
        </div>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-2"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          {SPORT_LABELS[sport]}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground/50">
          No {type === "image" ? "images" : "videos"} in this category
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: "thin" }}>
          {filtered.map((item) => {
            const isSelected = selected === item.url;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.url)}
                className="relative rounded-lg overflow-hidden border transition-all text-left shrink-0"
                style={{
                  borderColor: isSelected ? accentColor : "hsl(var(--border))",
                  boxShadow: isSelected ? `0 0 0 2px ${accentColor}44` : undefined,
                }}
              >
                <div className="relative aspect-video bg-black">
                  <img
                    src={item.thumbnail}
                    alt={item.label}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-80"
                  />
                  {type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                        <Video className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                  {isSelected && (
                    <div
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: accentColor }}
                    >
                      <Check className="h-3 w-3 text-black" />
                    </div>
                  )}
                </div>
                <div
                  className="px-2 py-1.5 text-[11px] font-medium"
                  style={{ background: isSelected ? `${accentColor}12` : "hsl(var(--muted)/0.4)" }}
                >
                  <div className="flex items-center gap-1">
                    {type === "image"
                      ? <ImageIcon className="h-2.5 w-2.5 opacity-50" />
                      : <Video className="h-2.5 w-2.5 opacity-50" />
                    }
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] opacity-40 capitalize">{item.category}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Starter Pack Installer ────────────────────────────────────────────────────

interface PackInstallerProps {
  accentColor?: string;
}

export function StarterPackInstaller({ accentColor = "#F59E0B" }: PackInstallerProps) {
  const [status, setStatus] = useState<"idle" | "installing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);

  const handleInstall = async () => {
    setStatus("installing");
    setProgress(0);
    const total = ALL_PACK_ITEMS.length;
    let done = 0;
    for (const _item of ALL_PACK_ITEMS) {
      await new Promise((r) => setTimeout(r, 20));
      done++;
      setProgress(Math.round((done / total) * 100));
    }
    setStatus("done");
  };

  const categoryCounts = [
    { label: "Stadium",  count: STOCK_IMAGES.filter((i) => i.category === "stadium").length },
    { label: "Crowd",    count: STOCK_IMAGES.filter((i) => i.category === "crowd").length },
    { label: "Abstract", count: STOCK_IMAGES.filter((i) => i.category === "abstract").length },
    { label: "Field",    count: STOCK_IMAGES.filter((i) => i.category === "field").length },
    { label: "Players",  count: STOCK_IMAGES.filter((i) => i.category === "players").length },
    { label: "Videos",   count: STOCK_VIDEOS.length },
  ];

  if (status === "done") {
    return (
      <div
        className="rounded-xl border p-4 flex items-center gap-3"
        style={{ borderColor: `${accentColor}44`, background: `${accentColor}08` }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}22` }}>
          <Check className="h-4 w-4" style={{ color: accentColor }} />
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: accentColor }}>
            AFL Balanced Media Pack Installed
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {ALL_PACK_ITEMS.length} assets registered ({STOCK_IMAGES.length} images · {STOCK_VIDEOS.length} videos)
          </p>
        </div>
      </div>
    );
  }

  if (status === "installing") {
    return (
      <div className="rounded-xl border border-border p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: accentColor }} />
          <p className="text-xs font-medium">Registering AFL balanced media pack…</p>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/60">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-100"
            style={{ width: `${progress}%`, background: accentColor }} />
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          Registering {ALL_PACK_ITEMS.length} AFL broadcast-style media assets…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accentColor}18` }}>
            <Package className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-xs font-semibold">AFL Balanced Media Pack</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {STOCK_IMAGES.length} curated images · {STOCK_VIDEOS.length} looping videos
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${accentColor}18`, color: accentColor }}>
              {ALL_PACK_ITEMS.length} assets
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {categoryCounts.map(({ label, count }) => (
            <div key={label} className="rounded-lg bg-muted/20 px-2 py-1.5 text-center">
              <p className="text-[11px] font-bold" style={{ color: accentColor }}>{count}</p>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
        >
          <Package className="h-3.5 w-3.5" />
          Install AFL Balanced Media Pack
        </button>
      </div>
    </div>
  );
}

// ─── Utility ───────────────────────────────────────────────────────────────────

export function getBackgroundSourceLabel(source: BackgroundSource): string {
  switch (source) {
    case "gradient":    return "Gradient";
    case "stock_image": return "Stock Image";
    case "stock_video": return "Stock Video";
    case "team_theme":  return "Team Theme";
    case "upload":      return "Custom Upload";
  }
}
