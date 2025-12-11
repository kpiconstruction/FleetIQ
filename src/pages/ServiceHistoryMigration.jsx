import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { format } from "date-fns";
import {
  Upload,
  FileText,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Database,
  ArrowRight,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ServiceHistoryMigration() {
  const [step, setStep] = useState(1);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [validatedRows, setValidatedRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["importBatches"],
    queryFn: () => base44.entities.ImportBatch.list("-created_date", 50),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data) => base44.entities.ImportBatch.create(data),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ["importBatches"] });
      setSelectedBatch(batch);
      setStep(2);
    },
  });

  const validateMutation = useMutation({
    mutationFn: async ({ rows, mapping }) => {
      const response = await base44.functions.invoke("processServiceImport", {
        action: "validateAndMap",
        rows,
        mapping,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setValidatedRows(data.validatedRows);
      setSummary(data.summary);
      setStep(4);
    },
  });

  const commitMutation = useMutation({
    mutationFn: async ({ batchId, includeDuplicates }) => {
      const response = await base44.functions.invoke("processServiceImport", {
        action: "commit",
        batchId,
        includeDuplicates,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["importBatches"] });
      setCommitDialogOpen(false);
      setStep(1);
      setSelectedBatch(null);
      setParsedData([]);
      setMapping({});
      setValidatedRows([]);
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
      
      const rows = lines.slice(1, 21).map((line) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        return row;
      });

      setParsedData(rows);

      // Auto-detect common column names
      const autoMapping = {};
      headers.forEach((header) => {
        const lower = header.toLowerCase();
        if (lower.includes("asset") || lower.includes("code")) autoMapping.asset_code = header;
        else if (lower.includes("rego") || lower.includes("registration")) autoMapping.rego = header;
        else if (lower.includes("date")) autoMapping.service_date = header;
        else if (lower.includes("odo") || lower.includes("km")) autoMapping.odometer_km = header;
        else if (lower.includes("workshop") || lower.includes("supplier")) autoMapping.workshop_name = header;
        else if (lower.includes("type")) autoMapping.service_type = header;
        else if (lower.includes("labour")) autoMapping.labour_cost = header;
        else if (lower.includes("parts")) autoMapping.parts_cost = header;
        else if (lower.includes("total") || lower.includes("cost")) autoMapping.total_cost = header;
        else if (lower.includes("note") || lower.includes("description")) autoMapping.notes = header;
        else if (lower.includes("reference") || lower.includes("id") || lower.includes("invoice")) autoMapping.external_reference = header;
      });

      setMapping(autoMapping);
    };

    reader.readAsText(file);
  };

  const handleStartBatch = (sourceSystem) => {
    const fileInput = document.getElementById("fileUpload");
    fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      createBatchMutation.mutate({
        source_system: sourceSystem,
        file_name: file.name,
        status: "MappingPending",
        summary_json: {},
      });

      handleFileUpload(e);
    };
  };

  const handleValidate = async () => {
    if (!selectedBatch || parsedData.length === 0) return;

    // Save all rows
    const rowsToCreate = parsedData.map((row) => ({
      import_batch_id: selectedBatch.id,
      raw_row_json: row,
      resolution_status: "Unmapped",
    }));

    await base44.entities.ImportedServiceRow.bulkCreate(rowsToCreate);

    // Trigger validation
    validateMutation.mutate({ rows: parsedData, mapping });
  };

  const handleCommit = () => {
    commitMutation.mutate({
      batchId: selectedBatch.id,
      includeDuplicates,
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      Mapped: "bg-emerald-50 text-emerald-700 border-emerald-200",
      VehicleNotFound: "bg-rose-50 text-rose-700 border-rose-200",
      InvalidData: "bg-amber-50 text-amber-700 border-amber-200",
      Duplicate: "bg-violet-50 text-violet-700 border-violet-200",
      Ready: "bg-blue-50 text-blue-700 border-blue-200",
      Ignored: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return (
      <Badge variant="outline" className={styles[status] || "bg-slate-100"}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <input type="file" id="fileUpload" accept=".csv,.xlsx" className="hidden" />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Database className="w-8 h-8 text-indigo-600" />
          Service History Migration
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          One-time import of historical service data
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center gap-4">
        {[
          { num: 1, label: "Upload", icon: Upload },
          { num: 2, label: "Map Fields", icon: MapPin },
          { num: 3, label: "Validate", icon: CheckCircle },
          { num: 4, label: "Review", icon: FileText },
          { num: 5, label: "Commit", icon: Database },
        ].map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className={`flex items-center gap-2 ${step >= s.num ? "text-indigo-600" : "text-slate-400"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= s.num ? "bg-indigo-600 text-white" : "bg-slate-200"
              }`}>
                <s.icon className="w-5 h-5" />
              </div>
              <span className="font-medium">{s.label}</span>
            </div>
            {idx < 4 && <ArrowRight className="w-5 h-5 text-slate-300" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleStartBatch("ExcelLegacy")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Excel / CSV Legacy
              </CardTitle>
              <CardDescription>Upload historical service data from Excel or CSV files</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Supports workshop exports, fleet management spreadsheets, and historical records
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleStartBatch("OdooLegacy")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-violet-600" />
                Odoo Legacy Export
              </CardTitle>
              <CardDescription>One-time import from Odoo system export</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Import service records from Odoo maintenance or fleet modules (CSV format)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Field Mapping */}
      {step === 2 && parsedData.length > 0 && (
        <div className="space-y-6">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Map the columns from your file to Fleet IQ fields. Preview shows first 20 rows.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Field Mapping</CardTitle>
              <CardDescription>Configure how your data maps to Fleet IQ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(parsedData[0]).map((col) => (
                  <div key={col} className="space-y-2">
                    <Label className="text-xs text-slate-600">{col}</Label>
                    <Select value={Object.entries(mapping).find(([_, v]) => v === col)?.[0] || "ignore"} onValueChange={(val) => {
                      if (val === "ignore") {
                        const newMapping = { ...mapping };
                        Object.keys(newMapping).forEach(k => {
                          if (newMapping[k] === col) delete newMapping[k];
                        });
                        setMapping(newMapping);
                      } else {
                        setMapping({ ...mapping, [val]: col });
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">Ignore</SelectItem>
                        <SelectItem value="asset_code">Asset Code</SelectItem>
                        <SelectItem value="rego">Registration</SelectItem>
                        <SelectItem value="vin">VIN</SelectItem>
                        <SelectItem value="service_date">Service Date</SelectItem>
                        <SelectItem value="odometer_km">Odometer (km)</SelectItem>
                        <SelectItem value="workshop_name">Workshop</SelectItem>
                        <SelectItem value="service_type">Service Type</SelectItem>
                        <SelectItem value="labour_cost">Labour Cost</SelectItem>
                        <SelectItem value="parts_cost">Parts Cost</SelectItem>
                        <SelectItem value="total_cost">Total Cost</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                        <SelectItem value="external_reference">External Ref</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={handleValidate} disabled={validateMutation.isPending}>
                  {validateMutation.isPending ? "Validating..." : "Validate & Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      {Object.keys(parsedData[0]).map((col) => (
                        <th key={col} className="p-2 text-left font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b">
                        {Object.values(row).map((val, vidx) => (
                          <td key={vidx} className="p-2">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-emerald-600">{summary.mapped}</p>
                <p className="text-sm text-slate-600">Mapped</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-rose-600">{summary.vehicleNotFound}</p>
                <p className="text-sm text-slate-600">Vehicle Not Found</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-amber-600">{summary.invalidData}</p>
                <p className="text-sm text-slate-600">Invalid Data</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-violet-600">{summary.duplicate}</p>
                <p className="text-sm text-slate-600">Duplicates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
                <p className="text-sm text-slate-600">Total Rows</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>
                Review mapped rows. Ready rows will be committed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Asset Code</TableHead>
                    <TableHead>Service Date</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Workshop</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedRows.slice(0, 50).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{getStatusBadge(row.resolution_status)}</TableCell>
                      <TableCell className="font-medium">{row.mapped_asset_code}</TableCell>
                      <TableCell>{row.mapped_service_date}</TableCell>
                      <TableCell>{row.mapped_odometer_km || "-"}</TableCell>
                      <TableCell>{row.mapped_workshop_name || "-"}</TableCell>
                      <TableCell>${row.mapped_total_cost || 0}</TableCell>
                      <TableCell className="text-xs text-slate-500">{row.resolution_notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeDuplicates"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="includeDuplicates">Include duplicate records in commit</Label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Back to Mapping</Button>
              <Button onClick={() => setCommitDialogOpen(true)} className="bg-indigo-600">
                Commit {summary.mapped + (includeDuplicates ? summary.duplicate : 0)} Records
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Commit Confirmation Dialog */}
      <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Batch Commit</DialogTitle>
            <DialogDescription>
              This will create {summary?.mapped || 0} {includeDuplicates ? `+ ${summary?.duplicate || 0} duplicate` : ""} service records.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Ensure you have reviewed all mapped records. Historical data will be permanently added to Fleet IQ.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCommit} disabled={commitMutation.isPending} className="bg-indigo-600">
              {commitMutation.isPending ? "Committing..." : "Confirm Commit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}