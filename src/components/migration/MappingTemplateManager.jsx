import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Save, Folder, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MappingTemplateManager({ currentMapping, onApplyTemplate }) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const queryClient = useQueryClient();

  // Fetch saved templates (stored as a simple entity)
  const { data: templates = [] } = useQuery({
    queryKey: ["mappingTemplates"],
    queryFn: async () => {
      try {
        return await base44.entities.MappingTemplate.list();
      } catch {
        return [];
      }
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.MappingTemplate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mappingTemplates"] });
      setSaveDialogOpen(false);
      setTemplateName("");
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id) => {
      return base44.entities.MappingTemplate.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mappingTemplates"] });
    },
  });

  const handleSave = () => {
    if (!templateName.trim()) return;
    saveTemplateMutation.mutate({
      name: templateName,
      mapping_config: currentMapping,
    });
  };

  return (
    <div className="flex items-center gap-3">
      {templates.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-600">Load Template:</Label>
          <Select onValueChange={(val) => {
            const template = templates.find(t => t.id === val);
            if (template) onApplyTemplate(template.mapping_config);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{template.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => setSaveDialogOpen(true)}
        className="gap-2"
      >
        <Save className="w-4 h-4" />
        Save Template
      </Button>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Save Mapping Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. Legacy Excel - Workshop A"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-slate-700 mb-2">Current Mapping:</p>
              <ul className="text-slate-600 space-y-1">
                {Object.entries(currentMapping).map(([key, val]) => (
                  <li key={key}>• {key} → {val}</li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
            >
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}