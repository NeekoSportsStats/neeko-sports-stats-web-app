import { useState } from "react";
import { Check, Image as ImageIcon, Video } from "lucide-react";
import type { BackgroundSource } from "./GraphicTemplates";

export interface StockMediaItem {
  id: string;
  url: string;
  thumbnail: string;
  category: string;
  type: "image" | "video";
  label: string;
}

export const STOCK_IMAGES: StockMediaItem[] = [
  {
    id: "stadium-night",
    type: "image",
    category: "stadium",
    label: "Stadium Night",
    url: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg",
    thumbnail: "https://images.pexels.com/photos/1263348/pexels-photo-1263348.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "stadium-lights",
    type: "image",
    category: "stadium",
    label: "Stadium Lights",
    url: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg",
    thumbnail: "https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "stadium-aerial",
    type: "image",
    category: "stadium",
    label: "Stadium Aerial",
    url: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg",
    thumbnail: "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "crowd-blur",
    type: "image",
    category: "crowd",
    label: "Crowd Blur",
    url: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "crowd-cheering",
    type: "image",
    category: "crowd",
    label: "Crowd Cheering",
    url: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg",
    thumbnail: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "grass-field",
    type: "image",
    category: "grass",
    label: "Grass Field",
    url: "https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg",
    thumbnail: "https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "grass-close",
    type: "image",
    category: "grass",
    label: "Grass Close",
    url: "https://images.pexels.com/photos/1174966/pexels-photo-1174966.jpeg",
    thumbnail: "https://images.pexels.com/photos/1174966/pexels-photo-1174966.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "abstract-dark",
    type: "image",
    category: "abstract",
    label: "Abstract Dark",
    url: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg",
    thumbnail: "https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "abstract-blue",
    type: "image",
    category: "abstract",
    label: "Abstract Blue",
    url: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg",
    thumbnail: "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "lights-bokeh",
    type: "image",
    category: "lights",
    label: "Bokeh Lights",
    url: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg",
    thumbnail: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "lights-stadium-floodlights",
    type: "image",
    category: "lights",
    label: "Floodlights",
    url: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg",
    thumbnail: "https://images.pexels.com/photos/1884576/pexels-photo-1884576.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "sport-action",
    type: "image",
    category: "stadium",
    label: "Sport Action",
    url: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg",
    thumbnail: "https://images.pexels.com/photos/3571098/pexels-photo-3571098.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
];

export const STOCK_VIDEOS: StockMediaItem[] = [
  {
    id: "vid-stadium-loop",
    type: "video",
    category: "stadium",
    label: "Stadium Flyover",
    url: "https://videos.pexels.com/video-files/3125990/3125990-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3125990/free-video-3125990.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "vid-crowd-roar",
    type: "video",
    category: "crowd",
    label: "Crowd Roar",
    url: "https://videos.pexels.com/video-files/1658832/1658832-uhd_2560_1440_30fps.mp4",
    thumbnail: "https://images.pexels.com/videos/1658832/free-video-1658832.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "vid-particles",
    type: "video",
    category: "particles",
    label: "Particles",
    url: "https://videos.pexels.com/video-files/3255122/3255122-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3255122/free-video-3255122.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "vid-lights-loop",
    type: "video",
    category: "lights",
    label: "Light Beams",
    url: "https://videos.pexels.com/video-files/2022395/2022395-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/2022395/free-video-2022395.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "vid-scoreboard",
    type: "video",
    category: "scoreboard",
    label: "Scoreboard",
    url: "https://videos.pexels.com/video-files/5150527/5150527-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/5150527/free-video-5150527.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
  {
    id: "vid-abstract-dark",
    type: "video",
    category: "particles",
    label: "Abstract Glow",
    url: "https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_25fps.mp4",
    thumbnail: "https://images.pexels.com/videos/3129671/free-video-3129671.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",
  },
];

const CATEGORIES_IMAGE = ["all", "stadium", "crowd", "grass", "abstract", "lights"];
const CATEGORIES_VIDEO = ["all", "stadium", "crowd", "particles", "lights", "scoreboard"];

interface Props {
  type: "image" | "video";
  selected: string | null;
  onSelect: (url: string) => void;
  accentColor?: string;
}

export function StockMediaPicker({ type, selected, onSelect, accentColor = "#F59E0B" }: Props) {
  const [activeCategory, setActiveCategory] = useState("all");

  const items = type === "image" ? STOCK_IMAGES : STOCK_VIDEOS;
  const categories = type === "image" ? CATEGORIES_IMAGE : CATEGORIES_VIDEO;

  const filtered = activeCategory === "all"
    ? items
    : items.filter((i) => i.category === activeCategory);

  return (
    <div className="space-y-2">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
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

      {/* Media grid */}
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((item) => {
          const isSelected = selected === item.url;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.url)}
              className="relative rounded-lg overflow-hidden border transition-all text-left"
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
    </div>
  );
}

export function getBackgroundSourceLabel(source: BackgroundSource): string {
  switch (source) {
    case "gradient":    return "Gradient";
    case "stock_image": return "Stock Image";
    case "stock_video": return "Stock Video";
    case "team_theme":  return "Team Theme";
    case "upload":      return "Custom Upload";
  }
}
