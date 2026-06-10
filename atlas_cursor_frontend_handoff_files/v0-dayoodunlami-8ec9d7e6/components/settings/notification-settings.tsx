"use client"

import { useState } from "react"
import { Save, Bell, Mail, MessageSquare, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export function NotificationSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    emailNotifications: true,
    emailProvider: "smtp",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUsername: "notifications@strategyai.com",
    smtpPassword: "",
    fromEmail: "noreply@strategyai.com",
    fromName: "Strategy AI",
    adminEmails: "admin@strategyai.com, support@strategyai.com",

    systemAlerts: true,
    documentProcessingAlerts: true,
    userActivityAlerts: false,
    securityAlerts: true,
    performanceAlerts: true,

    slackIntegration: false,
    slackWebhookUrl: "",
    slackChannel: "#strategy-ai-alerts",

    teamsIntegration: false,
    teamsWebhookUrl: "",

    customWebhooks: false,
    webhookUrl: "",
    webhookSecret: "",

    alertThresholds: {
      responseTime: "5",
      errorRate: "5",
      diskUsage: "80",
      memoryUsage: "85",
    },
  })

  const handleSave = () => {
    toast({
      title: "Notification settings saved",
      description: "Notification preferences have been updated successfully.",
    })
  }

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleThresholdChange = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      alertThresholds: { ...prev.alertThresholds, [key]: value },
    }))
  }

  const testEmailSettings = () => {
    toast({
      title: "Testing email configuration",
      description: "Sending test email...",
    })
    // Simulate email test
    setTimeout(() => {
      toast({
        title: "Test email sent",
        description: "Check your inbox for the test email.",
      })
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Send system notifications via email</p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => handleInputChange("emailNotifications", checked)}
            />
          </div>

          {settings.emailNotifications && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    value={settings.smtpHost}
                    onChange={(e) => handleInputChange("smtpHost", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input
                    id="smtp-port"
                    value={settings.smtpPort}
                    onChange={(e) => handleInputChange("smtpPort", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp-username">SMTP Username</Label>
                  <Input
                    id="smtp-username"
                    value={settings.smtpUsername}
                    onChange={(e) => handleInputChange("smtpUsername", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-password">SMTP Password</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    value={settings.smtpPassword}
                    onChange={(e) => handleInputChange("smtpPassword", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="from-email">From Email</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={settings.fromEmail}
                    onChange={(e) => handleInputChange("fromEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from-name">From Name</Label>
                  <Input
                    id="from-name"
                    value={settings.fromName}
                    onChange={(e) => handleInputChange("fromName", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-emails">Admin Email Addresses</Label>
                <Textarea
                  id="admin-emails"
                  value={settings.adminEmails}
                  onChange={(e) => handleInputChange("adminEmails", e.target.value)}
                  placeholder="admin1@example.com, admin2@example.com"
                  rows={2}
                />
              </div>

              <Button variant="outline" onClick={testEmailSettings}>
                Send Test Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alert Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>System Alerts</Label>
                <p className="text-sm text-muted-foreground">Critical system events and errors</p>
              </div>
              <Switch
                checked={settings.systemAlerts}
                onCheckedChange={(checked) => handleInputChange("systemAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Document Processing Alerts</Label>
                <p className="text-sm text-muted-foreground">Document upload and processing notifications</p>
              </div>
              <Switch
                checked={settings.documentProcessingAlerts}
                onCheckedChange={(checked) => handleInputChange("documentProcessingAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>User Activity Alerts</Label>
                <p className="text-sm text-muted-foreground">New user registrations and activity</p>
              </div>
              <Switch
                checked={settings.userActivityAlerts}
                onCheckedChange={(checked) => handleInputChange("userActivityAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Security Alerts</Label>
                <p className="text-sm text-muted-foreground">Security incidents and suspicious activity</p>
              </div>
              <Switch
                checked={settings.securityAlerts}
                onCheckedChange={(checked) => handleInputChange("securityAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Performance Alerts</Label>
                <p className="text-sm text-muted-foreground">System performance and resource usage</p>
              </div>
              <Switch
                checked={settings.performanceAlerts}
                onCheckedChange={(checked) => handleInputChange("performanceAlerts", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Third-Party Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Slack Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Slack Integration</Label>
                <p className="text-sm text-muted-foreground">Send notifications to Slack channels</p>
              </div>
              <Switch
                checked={settings.slackIntegration}
                onCheckedChange={(checked) => handleInputChange("slackIntegration", checked)}
              />
            </div>

            {settings.slackIntegration && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    value={settings.slackWebhookUrl}
                    onChange={(e) => handleInputChange("slackWebhookUrl", e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slack-channel">Default Channel</Label>
                  <Input
                    id="slack-channel"
                    value={settings.slackChannel}
                    onChange={(e) => handleInputChange("slackChannel", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Teams Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Microsoft Teams Integration</Label>
                <p className="text-sm text-muted-foreground">Send notifications to Teams channels</p>
              </div>
              <Switch
                checked={settings.teamsIntegration}
                onCheckedChange={(checked) => handleInputChange("teamsIntegration", checked)}
              />
            </div>

            {settings.teamsIntegration && (
              <div className="space-y-2">
                <Label htmlFor="teams-webhook">Teams Webhook URL</Label>
                <Input
                  id="teams-webhook"
                  value={settings.teamsWebhookUrl}
                  onChange={(e) => handleInputChange("teamsWebhookUrl", e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..."
                />
              </div>
            )}
          </div>

          {/* Custom Webhooks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Custom Webhooks</Label>
                <p className="text-sm text-muted-foreground">Send notifications to custom endpoints</p>
              </div>
              <Switch
                checked={settings.customWebhooks}
                onCheckedChange={(checked) => handleInputChange("customWebhooks", checked)}
              />
            </div>

            {settings.customWebhooks && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    value={settings.webhookUrl}
                    onChange={(e) => handleInputChange("webhookUrl", e.target.value)}
                    placeholder="https://your-endpoint.com/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Webhook Secret</Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    value={settings.webhookSecret}
                    onChange={(e) => handleInputChange("webhookSecret", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alert Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="response-time-threshold">Response Time Threshold (seconds)</Label>
              <Input
                id="response-time-threshold"
                type="number"
                value={settings.alertThresholds.responseTime}
                onChange={(e) => handleThresholdChange("responseTime", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="error-rate-threshold">Error Rate Threshold (%)</Label>
              <Input
                id="error-rate-threshold"
                type="number"
                value={settings.alertThresholds.errorRate}
                onChange={(e) => handleThresholdChange("errorRate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disk-usage-threshold">Disk Usage Threshold (%)</Label>
              <Input
                id="disk-usage-threshold"
                type="number"
                value={settings.alertThresholds.diskUsage}
                onChange={(e) => handleThresholdChange("diskUsage", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memory-usage-threshold">Memory Usage Threshold (%)</Label>
              <Input
                id="memory-usage-threshold"
                type="number"
                value={settings.alertThresholds.memoryUsage}
                onChange={(e) => handleThresholdChange("memoryUsage", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Notification Settings
        </Button>
      </div>
    </div>
  )
}
