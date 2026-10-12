"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { CopyIcon, DownloadIcon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { buildUtmUrl, qrFileName, UTM_KEYS, UTM_SUGGESTIONS, type UtmParams } from "@/lib/utm";

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** UTM link builder and QR code for a published step (8.5e). Everything runs in the browser. */
export function UtmQrDialog({
  open,
  onOpenChange,
  url,
  stepSlug,
  stepName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  stepSlug: string;
  stepName: string;
}) {
  const t = useT();
  const [params, setParams] = useState<UtmParams>({});
  const [svg, setSvg] = useState("");
  const link = useMemo(() => buildUtmUrl(url, params) ?? url, [url, params]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M" })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(""));
    return () => {
      live = false;
    };
  }, [link, open]);

  const svgUrl = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("utm.title")}</DialogTitle>
          <DialogDescription>{t("utm.description", { name: stepName })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <div className="grid content-start gap-3">
            {UTM_KEYS.map((k) => (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={`utm-${k}`}>
                  {t(`utm.fields.${k}`)}
                  {k === "source" || k === "medium" || k === "campaign" ? null : (
                    <span className="ms-1 font-normal text-muted-foreground">{t("utm.optional")}</span>
                  )}
                </Label>
                <Input
                  id={`utm-${k}`}
                  dir="auto"
                  value={params[k] ?? ""}
                  placeholder={t(`utm.placeholders.${k}`)}
                  list={k === "source" || k === "medium" ? `utm-${k}-list` : undefined}
                  maxLength={100}
                  onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))}
                />
              </div>
            ))}
            <datalist id="utm-source-list">
              {UTM_SUGGESTIONS.source.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <datalist id="utm-medium-list">
              {UTM_SUGGESTIONS.medium.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="grid content-start justify-items-center gap-2">
            <div
              className="aspect-square w-full max-w-[200px] rounded-xl border bg-white p-2"
              role="img"
              aria-label={t("utm.qrAlt")}
              data-testid="utm-qr"
            >
              {svgUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, not a remote image
                <img src={svgUrl} alt="" className="size-full" />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!svg}
                onClick={async () => {
                  const png = await QRCode.toDataURL(link, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
                  download(png, qrFileName(stepSlug, params, "png"));
                }}
              >
                <DownloadIcon /> PNG
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!svg}
                onClick={() => download(svgUrl, qrFileName(stepSlug, params, "svg"))}
              >
                <DownloadIcon /> SVG
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="utm-result">{t("utm.result")}</Label>
          <div className="flex gap-2">
            <Input
              id="utm-result"
              readOnly
              dir="ltr"
              value={link}
              onFocus={(e) => e.target.select()}
              data-testid="utm-url"
            />
            <Button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                toast.success(t("utm.copied"));
              }}
            >
              <CopyIcon /> {t("common.copy")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("utm.hint")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
