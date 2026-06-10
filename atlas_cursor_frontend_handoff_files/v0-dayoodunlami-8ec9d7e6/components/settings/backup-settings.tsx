"use client"

import { useState } from "react"
import { Save, Database, Download, Upload, Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

export function BackupSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    enableAutomaticBackups: true,
    backupFrequency: "daily",
    backupTime: "02:00",
    retentionPeriod: "30",
    backupLocation: "cloud",
    cloudProvider: "vercel",
    localBackupPath: "/backups",
    enableEncryption: true,
    encryptionKey: "",
    enableCompression: true,
    includeDocuments: true,
    includeUserData: true,
    includeSystemLogs: false,
    includeAnalytics: true,
  })

  const [backupHistory] = useState([
    {
      id: "1",
      date: "2024-01-15 02:00:00",
      type: "automatic",
      status: "completed",
      size: "2.4 GB",
      duration: "12 minutes",
    },
    {
      id: "2",
      date: "2024-01-14 02:00:00",
      type: "automatic",
      status: "completed",
      size: "2.3 GB",
      duration: "11 minutes",
    },
    {
      id: "3",
      date: "2024-01-13 14:30:00",
      type: "manual",
      status: "completed",
      size: "2.3 GB",
      duration: "10 minutes",
    },
    {
      id: "4",
      date: "2024-01-13 02:00:00",
      type: "automatic",
      status: "failed",
      size: "-",
      duration: "-",
    },
  ])

  const handleSave = () => {
    toast({
      title: "Backup settings saved",
      description: "Backup configuration has been updated successfully.",
    })
  }

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const createManualBackup = () => {
    toast({
      title: "Creating backup",
      description: "Manual backup has been initiated...",
    })
    // Simulate backup creation
    setTimeout(() => {
      toast({
        title: "Backup completed",
        description: "Manual backup has been created successfully.",
      })
    }, 3000)
  }

  const restoreFromBackup = (backupId: string) => {
    toast({
      title: "Restore initiated",
      description: `Restoring from backup ${backupId}...`,
    })
  }

  const downloadBackup = (backupId: string) => {
    toast({
      title: "Download started",
      description: `Downloading backup ${backupId}...`,
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "in-progress":
        return <Badge variant="secondary">In Progress</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Automatic Backup Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Automatic Backups</Label>
              <p className="text-sm text-muted-foreground">Automatically create system backups</p>
            </div>
            <Switch
              checked={settings.enableAutomaticBackups}
              onCheckedChange={(checked) => handleInputChange("enableAutomaticBackups", checked)}
            />
          </div>

          {settings.enableAutomaticBackups && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="backup-frequency">Backup Frequency</Label>
                  <Select
                    value={settings.backupFrequency}
                    onValueChange={(value) => handleInputChange("backupFrequency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backup-time">Backup Time</Label>
                  <Input
                    id="backup-time"
                    type="time"
                    value={settings.backupTime}
                    onChange={(e) => handleInputChange("backupTime", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retention-period">Retention Period (days)</Label>
                  <Input
                    id="retention-period"
                    type="number"
                    value={settings.retentionPeriod}
                    onChange={(e) => handleInputChange("retentionPeriod", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="backup-location">Backup Location</Label>
                  <Select
                    value={settings.backupLocation}
                    onValueChange={(value) => handleInputChange("backupLocation", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cloud">Cloud Storage</SelectItem>
                      <SelectItem value="local">Local Storage</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {settings.backupLocation === "cloud" && (
                  <div className="space-y-2">
                    <Label htmlFor="cloud-provider">Cloud Provider</Label>
                    <Select
                      value={settings.cloudProvider}
                      onValueChange={(value) => handleInputChange("cloudProvider", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vercel">Vercel Blob</SelectItem>
                        <SelectItem value="aws">AWS S3</SelectItem>
                        <SelectItem value="gcp">Google Cloud Storage</SelectItem>
                        <SelectItem value="azure">Azure Blob Storage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup Content & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Documents</Label>
                <p className="text-sm text-muted-foreground">Backup uploaded documents and files</p>
              </div>
              <Switch
                checked={settings.includeDocuments}
                onCheckedChange={(checked) => handleInputChange("includeDocuments", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include User Data</Label>
                <p className="text-sm text-muted-foreground">Backup user accounts and preferences</p>
              </div>
              <Switch
                checked={settings.includeUserData}
                onCheckedChange={(checked) => handleInputChange("includeUserData", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include System Logs</Label>
                <p className="text-sm text-muted-foreground">Backup system and audit logs</p>
              </div>
              <Switch
                checked={settings.includeSystemLogs}
                onCheckedChange={(checked) => handleInputChange("includeSystemLogs", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Analytics Data</Label>
                <p className="text-sm text-muted-foreground">Backup analytics and usage data</p>
              </div>
              <Switch
                checked={settings.includeAnalytics}
                onCheckedChange={(checked) => handleInputChange("includeAnalytics", checked)}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Encryption</Label>
                <p className="text-sm text-muted-foreground">Encrypt backup files for security</p>
              </div>
              <Switch
                checked={settings.enableEncryption}
                onCheckedChange={(checked) => handleInputChange("enableEncryption", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Compression</Label>
                <p className="text-sm text-muted-foreground">Compress backup files to save space</p>
              </div>
              <Switch
                checked={settings.enableCompression}
                onCheckedChange={(checked) => handleInputChange("enableCompression", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Backup History
            </CardTitle>
            <Button onClick={createManualBackup}>
              <Upload className="mr-2 h-4 w-4" />
              Create Manual Backup
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backupHistory.map((backup) => (
              <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{backup.date}</span>
                  </div>
                  <Badge variant="outline">{backup.type}</Badge>
                  {getStatusBadge(backup.status)}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    <span>{backup.size}</span>
                    {backup.duration !== "-" && <span> • {backup.duration}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadBackup(backup.id)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreFromBackup(backup.id)}
                      disabled={backup.status !== "completed"}
                    >
                      Restore
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Backup Settings
        </Button>
      </div>
    </div>
  )
}
