"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, Shield, Users, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

interface User {
  id: string
  name: string
  email: string
  role: "admin" | "analyst" | "public"
  status: "active" | "inactive"
  lastLogin: string
  createdAt: string
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "Admin User",
      email: "admin@strategyai.com",
      role: "admin",
      status: "active",
      lastLogin: "2024-01-15 14:30",
      createdAt: "2024-01-01",
    },
    {
      id: "2",
      name: "John Analyst",
      email: "john@networkrail.co.uk",
      role: "analyst",
      status: "active",
      lastLogin: "2024-01-15 09:15",
      createdAt: "2024-01-05",
    },
    {
      id: "3",
      name: "Public User",
      email: "user@example.com",
      role: "public",
      status: "active",
      lastLogin: "2024-01-14 16:45",
      createdAt: "2024-01-10",
    },
  ])

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "public" as const,
  })

  const [userSettings, setUserSettings] = useState({
    allowSelfRegistration: true,
    requireEmailVerification: true,
    defaultRole: "public",
    sessionTimeout: "60",
    maxLoginAttempts: "5",
    passwordMinLength: "8",
    requireStrongPassword: true,
  })

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-100 text-red-800">Admin</Badge>
      case "analyst":
        return <Badge className="bg-blue-100 text-blue-800">Analyst</Badge>
      case "public":
        return <Badge className="bg-green-100 text-green-800">Public</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
    )
  }

  const handleAddUser = () => {
    const user: User = {
      id: Date.now().toString(),
      ...newUser,
      status: "active",
      lastLogin: "Never",
      createdAt: new Date().toISOString().split("T")[0],
    }
    setUsers([...users, user])
    setNewUser({ name: "", email: "", role: "public" })
  }

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId))
  }

  const handleToggleStatus = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId ? { ...user, status: user.status === "active" ? "inactive" : "active" } : user,
      ),
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Name</Label>
                    <Input
                      id="user-name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public User</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddUser} className="w-full">
                    Add User
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.lastLogin}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(user.id)}>
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-role">Default Role for New Users</Label>
              <Select
                value={userSettings.defaultRole}
                onValueChange={(value) => setUserSettings({ ...userSettings, defaultRole: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public User</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Input
                id="session-timeout"
                type="number"
                value={userSettings.sessionTimeout}
                onChange={(e) => setUserSettings({ ...userSettings, sessionTimeout: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
              <Input
                id="max-login-attempts"
                type="number"
                value={userSettings.maxLoginAttempts}
                onChange={(e) => setUserSettings({ ...userSettings, maxLoginAttempts: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-min-length">Minimum Password Length</Label>
              <Input
                id="password-min-length"
                type="number"
                value={userSettings.passwordMinLength}
                onChange={(e) => setUserSettings({ ...userSettings, passwordMinLength: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Self Registration</Label>
                <p className="text-sm text-muted-foreground">Allow users to register themselves</p>
              </div>
              <Switch
                checked={userSettings.allowSelfRegistration}
                onCheckedChange={(checked) => setUserSettings({ ...userSettings, allowSelfRegistration: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Email Verification</Label>
                <p className="text-sm text-muted-foreground">Users must verify their email address</p>
              </div>
              <Switch
                checked={userSettings.requireEmailVerification}
                onCheckedChange={(checked) => setUserSettings({ ...userSettings, requireEmailVerification: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Strong Passwords</Label>
                <p className="text-sm text-muted-foreground">Enforce strong password requirements</p>
              </div>
              <Switch
                checked={userSettings.requireStrongPassword}
                onCheckedChange={(checked) => setUserSettings({ ...userSettings, requireStrongPassword: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">Public Users</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• View public documents</li>
                  <li>• Submit AI queries</li>
                  <li>• Provide feedback</li>
                  <li>• View railway map</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Analysts</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• All public permissions</li>
                  <li>• Upload documents</li>
                  <li>• Edit document metadata</li>
                  <li>• Generate reports</li>
                  <li>• Access analytics</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Administrators</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• All analyst permissions</li>
                  <li>• Manage users</li>
                  <li>• System configuration</li>
                  <li>• Bulk operations</li>
                  <li>• System monitoring</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
