"use client"

import { useState } from "react"
import { Save, Shield, Key, Lock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export function SecuritySettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    enableTwoFactor: true,
    enableAPIKeyAuth: true,
    apiKeyExpiration: "90",
    enableRateLimit: true,
    rateLimitRequests: "100",
    rateLimitWindow: "60",
    enableIPWhitelist: false,
    ipWhitelist: "",
    enableAuditLog: true,
    auditLogRetention: "365",
    enableEncryption: true,
    encryptionAlgorithm: "AES-256",
    enableSSL: true,
    sslCertificateExpiry: "2024-12-31",
    enableCORS: true,
    allowedOrigins: "https://strategyai.com, https://networkrail.co.uk",
    enableCSP: true,
    cspPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  })

  const handleSave = () => {
    toast({
      title: "Security settings saved",
      description: "Security configuration has been updated successfully.",
    })
  }

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication & Access Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Require 2FA for admin accounts</p>
              </div>
              <Switch
                checked={settings.enableTwoFactor}
                onCheckedChange={(checked) => handleInputChange("enableTwoFactor", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable API Key Authentication</Label>
                <p className="text-sm text-muted-foreground">Require API keys for programmatic access</p>
              </div>
              <Switch
                checked={settings.enableAPIKeyAuth}
                onCheckedChange={(checked) => handleInputChange("enableAPIKeyAuth", checked)}
              />
            </div>

            {settings.enableAPIKeyAuth && (
              <div className="space-y-2">
                <Label htmlFor="api-key-expiration">API Key Expiration (days)</Label>
                <Input
                  id="api-key-expiration"
                  type="number"
                  value={settings.apiKeyExpiration}
                  onChange={(e) => handleInputChange("apiKeyExpiration", e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Rate Limiting & Access Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Rate Limiting</Label>
                <p className="text-sm text-muted-foreground">Limit API requests per user</p>
              </div>
              <Switch
                checked={settings.enableRateLimit}
                onCheckedChange={(checked) => handleInputChange("enableRateLimit", checked)}
              />
            </div>

            {settings.enableRateLimit && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rate-limit-requests">Requests per Window</Label>
                  <Input
                    id="rate-limit-requests"
                    type="number"
                    value={settings.rateLimitRequests}
                    onChange={(e) => handleInputChange("rateLimitRequests", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-limit-window">Window Duration (seconds)</Label>
                  <Input
                    id="rate-limit-window"
                    type="number"
                    value={settings.rateLimitWindow}
                    onChange={(e) => handleInputChange("rateLimitWindow", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable IP Whitelist</Label>
                <p className="text-sm text-muted-foreground">Restrict access to specific IP addresses</p>
              </div>
              <Switch
                checked={settings.enableIPWhitelist}
                onCheckedChange={(checked) => handleInputChange("enableIPWhitelist", checked)}
              />
            </div>

            {settings.enableIPWhitelist && (
              <div className="space-y-2">
                <Label htmlFor="ip-whitelist">Allowed IP Addresses (comma separated)</Label>
                <Textarea
                  id="ip-whitelist"
                  value={settings.ipWhitelist}
                  onChange={(e) => handleInputChange("ipWhitelist", e.target.value)}
                  placeholder="192.168.1.1, 10.0.0.0/8, 172.16.0.0/12"
                  rows={3}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Data Protection & Encryption
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Data Encryption</Label>
                <p className="text-sm text-muted-foreground">Encrypt sensitive data at rest</p>
              </div>
              <Switch
                checked={settings.enableEncryption}
                onCheckedChange={(checked) => handleInputChange("enableEncryption", checked)}
              />
            </div>

            {settings.enableEncryption && (
              <div className="space-y-2">
                <Label htmlFor="encryption-algorithm">Encryption Algorithm</Label>
                <Select
                  value={settings.encryptionAlgorithm}
                  onValueChange={(value) => handleInputChange("encryptionAlgorithm", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AES-256">AES-256 (Recommended)</SelectItem>
                    <SelectItem value="AES-128">AES-128</SelectItem>
                    <SelectItem value="ChaCha20">ChaCha20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable SSL/TLS</Label>
                <p className="text-sm text-muted-foreground">Force HTTPS connections</p>
              </div>
              <Switch
                checked={settings.enableSSL}
                onCheckedChange={(checked) => handleInputChange("enableSSL", checked)}
              />
            </div>

            {settings.enableSSL && (
              <div className="space-y-2">
                <Label htmlFor="ssl-expiry">SSL Certificate Expiry</Label>
                <Input
                  id="ssl-expiry"
                  type="date"
                  value={settings.sslCertificateExpiry}
                  onChange={(e) => handleInputChange("sslCertificateExpiry", e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Security Headers & CORS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable CORS</Label>
                <p className="text-sm text-muted-foreground">Configure Cross-Origin Resource Sharing</p>
              </div>
              <Switch
                checked={settings.enableCORS}
                onCheckedChange={(checked) => handleInputChange("enableCORS", checked)}
              />
            </div>

            {settings.enableCORS && (
              <div className="space-y-2">
                <Label htmlFor="allowed-origins">Allowed Origins</Label>
                <Textarea
                  id="allowed-origins"
                  value={settings.allowedOrigins}
                  onChange={(e) => handleInputChange("allowedOrigins", e.target.value)}
                  placeholder="https://example.com, https://app.example.com"
                  rows={2}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Content Security Policy</Label>
                <p className="text-sm text-muted-foreground">Configure CSP headers for XSS protection</p>
              </div>
              <Switch
                checked={settings.enableCSP}
                onCheckedChange={(checked) => handleInputChange("enableCSP", checked)}
              />
            </div>

            {settings.enableCSP && (
              <div className="space-y-2">
                <Label htmlFor="csp-policy">CSP Policy</Label>
                <Textarea
                  id="csp-policy"
                  value={settings.cspPolicy}
                  onChange={(e) => handleInputChange("cspPolicy", e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit & Monitoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Audit Logging</Label>
                <p className="text-sm text-muted-foreground">Log all system activities and access attempts</p>
              </div>
              <Switch
                checked={settings.enableAuditLog}
                onCheckedChange={(checked) => handleInputChange("enableAuditLog", checked)}
              />
            </div>

            {settings.enableAuditLog && (
              <div className="space-y-2">
                <Label htmlFor="audit-retention">Audit Log Retention (days)</Label>
                <Input
                  id="audit-retention"
                  type="number"
                  value={settings.auditLogRetention}
                  onChange={(e) => handleInputChange("auditLogRetention", e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Security Settings
        </Button>
      </div>
    </div>
  )
}
