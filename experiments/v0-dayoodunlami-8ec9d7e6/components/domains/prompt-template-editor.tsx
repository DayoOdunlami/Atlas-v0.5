"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface PromptTemplate {
  id: string
  name: string
  description: string
  template: string
  variables: string[]
}

interface PromptTemplateEditorProps {
  domainId: string
  useCaseId: string
  template: PromptTemplate
  onClose: () => void
  onSave: (template: PromptTemplate) => void
}

export function PromptTemplateEditor({ domainId, useCaseId, template, onClose, onSave }: PromptTemplateEditorProps) {
  const [editedTemplate, setEditedTemplate] = useState<PromptTemplate>({ ...template })

  const extractVariables = (templateText: string): string[] => {
    const matches = templateText.match(/\{\{([^}]+)\}\}/g)
    return matches ? matches.map((match) => match.slice(2, -2)) : []
  }

  const handleTemplateChange = (newTemplate: string) => {
    const variables = extractVariables(newTemplate)
    setEditedTemplate((prev) => ({
      ...prev,
      template: newTemplate,
      variables,
    }))
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Prompt Template: {template.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={editedTemplate.name}
                onChange={(e) => setEditedTemplate((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editedTemplate.description}
                onChange={(e) => setEditedTemplate((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prompt Template</Label>
            <Textarea
              value={editedTemplate.template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              rows={8}
              placeholder="Enter your prompt template here. Use {{variable_name}} for dynamic variables..."
            />
            <p className="text-xs text-muted-foreground">
              Use double curly braces for variables: {`{{variable_name}}`}
            </p>
          </div>

          {editedTemplate.variables.length > 0 && (
            <div className="space-y-2">
              <Label>Detected Variables</Label>
              <div className="flex flex-wrap gap-1">
                {editedTemplate.variables.map((variable) => (
                  <Badge key={variable} variant="outline">
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onSave(editedTemplate)}>Save Template</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
