import { useState } from "react";
import { useSettings, type Settings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Eye, EyeOff, CloudUpload, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export function SettingsPage() {
  const { settings, loading, saving, save, testConnection, testResult, triggerSync, syncing } =
    useSettings();

  if (loading || !settings) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 text-muted-foreground">Loading settings...</div>
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
  }) => Promise<boolean | undefined>;
  testConnection: () => Promise<{ ok: boolean; error?: string }>;
  testResult: { ok: boolean; error?: string } | null;
  triggerSync: () => Promise<void>;
  syncing: boolean;
}) {
  const [apiKey, setApiKey] = useState(settings.pocketApiKey);
  const [showKey, setShowKey] = useState(false);
  const [bucket, setBucket] = useState(settings.s3Bucket);
  const [prefix, setPrefix] = useState(settings.s3Prefix);
  const [profile, setProfile] = useState(settings.awsProfile);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const updates: Record<string, string> = {};
    if (apiKey !== settings?.pocketApiKey) updates.pocketApiKey = apiKey;
    if (bucket !== settings?.s3Bucket) updates.s3Bucket = bucket;
    if (prefix !== settings?.s3Prefix) updates.s3Prefix = prefix;
    if (profile !== settings?.awsProfile) updates.awsProfile = profile;
    const ok = await save(updates);
    if (ok) {
      setDirty(false);
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
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Pocket API Key */}
      <Card className="bg-[#2b2b2b] border-border">
        <CardContent className="pt-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Pocket API Key</h2>
            <p className="text-sm text-muted-foreground">
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
          </div>
          <div className="flex gap-2">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => markDirty(setApiKey)(e.target.value)}
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

      {/* S3 Backup */}
      <Card className="bg-[#2b2b2b] border-border">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">S3 Backup</h2>
            <Badge variant="outline" className="text-xs">
              Optional
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically sync your data to an S3 bucket after every change. Works with any
            S3-compatible store (AWS, MinIO, R2, etc.).
          </p>

          <Separator />

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium" htmlFor="s3-bucket">
                Bucket
              </label>
              <Input
                id="s3-bucket"
                value={bucket}
                onChange={(e) => markDirty(setBucket)(e.target.value)}
                placeholder="my-seam-backup"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="s3-prefix">
                Prefix
              </label>
              <Input
                id="s3-prefix"
                value={prefix}
                onChange={(e) => markDirty(setPrefix)(e.target.value)}
                placeholder="seam/"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Key prefix for all objects (e.g. &quot;seam/&quot;)
              </p>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="aws-profile">
                AWS Profile
              </label>
              <Input
                id="aws-profile"
                value={profile}
                onChange={(e) => markDirty(setProfile)(e.target.value)}
                placeholder="default"
                className="mt-1"
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

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty || saving} className="gap-1.5 cursor-pointer">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
        {saved && <span className="text-sm text-green-500">Settings saved</span>}
      </div>
    </div>
  );
}
