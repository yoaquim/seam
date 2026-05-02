import { useState } from "react";
import { useSettings, type Settings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Settings as SettingsIcon,
  Save,
  Eye,
  EyeOff,
  CloudUpload,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

const MODEL_OPTIONS: { value: string; label: string; hint?: string }[] = [
  { value: "", label: "Default (Claude Code's choice)" },
  { value: "claude-opus-4-7", label: "Opus 4.7", hint: "Most capable, slowest, most expensive" },
  {
    value: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    hint: "Recommended — balanced quality and cost",
  },
  {
    value: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    hint: "Fastest and cheapest, may miss subtle details",
  },
];

export function SettingsPage() {
  const { settings, loading, saving, save, testConnection, testResult, triggerSync, syncing } =
    useSettings();

  if (loading || !settings) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-muted-foreground">Loading settings...</div>
    );
  }

  return (
    <SettingsForm
      {...{ settings, saving, save, testConnection, testResult, triggerSync, syncing }}
    />
  );
}

function SettingsForm({
  settings,
  saving,
  save,
  testConnection,
  testResult,
  triggerSync,
  syncing,
}: {
  settings: Settings;
  saving: boolean;
  save: (u: {
    pocketApiKey?: string;
    s3Bucket?: string;
    s3Prefix?: string;
    awsProfile?: string;
    analysisModel?: string;
  }) => Promise<boolean | undefined>;
  testConnection: () => Promise<{ ok: boolean; error?: string }>;
  testResult: { ok: boolean; error?: string } | null;
  triggerSync: () => Promise<void>;
  syncing: boolean;
}) {
  const [apiKey, setApiKey] = useState(settings.pocketApiKey);
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [bucket, setBucket] = useState(settings.s3Bucket);
  const [prefix, setPrefix] = useState(settings.s3Prefix);
  const [profile, setProfile] = useState(settings.awsProfile);
  const [analysisModel, setAnalysisModel] = useState(settings.analysisModel);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const updates: Record<string, string> = {};
    // Only send API key if the user actually edited the field (value is masked on load)
    if (apiKeyEdited) updates.pocketApiKey = apiKey;
    if (bucket !== settings.s3Bucket) updates.s3Bucket = bucket;
    if (prefix !== settings.s3Prefix) updates.s3Prefix = prefix;
    if (profile !== settings.awsProfile) updates.awsProfile = profile;
    if (analysisModel !== settings.analysisModel) updates.analysisModel = analysisModel;
    const ok = await save(updates);
    if (ok) {
      setDirty(false);
      setApiKeyEdited(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const markDirty = <T,>(setter: (v: T) => void) => {
    return (v: T) => {
      setter(v);
      setDirty(true);
      setSaved(false);
    };
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Settings
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure your Pocket API key, Claude model, and optional S3 backup
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-green-500">Saved</span>}
            <Button
              onClick={handleSave}
              disabled={!dirty || saving}
              size="sm"
              className="gap-1.5 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Pocket API Key */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Pocket API Key</h2>
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Required to sync recordings.{" "}
                <a
                  href="https://app.heypocket.com/app/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  Get your key
                </a>
              </p>
              <div className="flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    markDirty(setApiKey)(e.target.value);
                    setApiKeyEdited(true);
                  }}
                  placeholder="pk_your_api_key_here"
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKey(!showKey)}
                  className="shrink-0 cursor-pointer"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claude Model */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Claude Model
            </h2>
            <Badge variant="outline" className="text-xs">
              Optional
            </Badge>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Model used by Claude Code when analyzing recordings. Leave as Default to use
                whatever model your Claude Code CLI is configured for.
              </p>
              <div>
                <label
                  htmlFor="analysis-model"
                  className="text-xs text-muted-foreground block mb-1"
                >
                  Analysis model
                </label>
                <select
                  id="analysis-model"
                  value={analysisModel}
                  onChange={(e) => markDirty(setAnalysisModel)(e.target.value)}
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer dark:bg-input/30"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value || "default"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {MODEL_OPTIONS.find((o) => o.value === analysisModel)?.hint && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {MODEL_OPTIONS.find((o) => o.value === analysisModel)?.hint}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* S3 Backup */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">S3 Backup</h2>
            <Badge variant="outline" className="text-xs">
              Optional
            </Badge>
          </div>
          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Automatically sync your data to an S3 bucket after every change. Works with any
                S3-compatible store (AWS, MinIO, R2, etc.).
              </p>

              <Separator />

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1" htmlFor="s3-bucket">
                    Bucket
                  </label>
                  <Input
                    id="s3-bucket"
                    value={bucket}
                    onChange={(e) => markDirty(setBucket)(e.target.value)}
                    placeholder="my-seam-backup"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1" htmlFor="s3-prefix">
                    Prefix
                  </label>
                  <Input
                    id="s3-prefix"
                    value={prefix}
                    onChange={(e) => markDirty(setPrefix)(e.target.value)}
                    placeholder="seam/"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Key prefix for all objects (e.g. &quot;seam/&quot;)
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1" htmlFor="aws-profile">
                    AWS Profile
                  </label>
                  <Input
                    id="aws-profile"
                    value={profile}
                    onChange={(e) => markDirty(setProfile)(e.target.value)}
                    placeholder="default"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For SSO or named profile users. Leave blank for default credential chain.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  disabled={!bucket}
                  className="gap-1.5 cursor-pointer"
                >
                  {testResult?.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : testResult && !testResult.ok ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CloudUpload className="h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerSync}
                  disabled={!bucket || syncing}
                  className="gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
                {testResult && !testResult.ok && testResult.error && (
                  <span className="text-xs text-red-400 truncate max-w-xs">{testResult.error}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
