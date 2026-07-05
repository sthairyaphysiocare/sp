import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface Props {
  /** Data URL or object URL of the source image to crop. */
  imageSrc: string;
  onCancel: () => void;
  /** Receives the cropped result as a JPEG data URL. */
  onCropped: (dataUrl: string) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Extracts the cropped pixel region onto a canvas and returns a JPEG data URL. */
async function cropToDataUrl(
  imageSrc: string,
  cropPixels: Area,
  outputSize = 512,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(
    img,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize,
    outputSize,
  );
  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Square (1:1) image cropper modal. Intercepts a freshly-selected file
 * before it's applied anywhere, lets the user frame it, and hands back a
 * cropped JPEG data URL on "Crop & Save".
 */
export function ImageCropModal({ imageSrc, onCancel, onCropped }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  async function confirm() {
    if (!pixels || busy) return;
    setBusy(true);
    try {
      const dataUrl = await cropToDataUrl(imageSrc, pixels);
      onCropped(dataUrl);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border shadow-2xl overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Adjust Photo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag to reposition, use the slider to zoom. Square crop only.
          </p>
        </div>
        <div className="relative w-full aspect-square bg-muted">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="crop-zoom">
              Zoom
            </label>
            <input
              id="crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              <X className="size-4" /> Cancel
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={busy || !pixels}
              className="brand-gradient text-white border-0"
            >
              <Check className="size-4" /> {busy ? "Saving..." : "Crop & Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
