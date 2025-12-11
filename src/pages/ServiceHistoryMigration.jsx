import React, { useState, useMemo } from "react";
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
  Search,
  Edit,
  Trash2,
  Save,
  Ban,
  RefreshCw,
  Lock,
} from "lucide-react";
import VehicleSearchDialog from "../components/migration/VehicleSearchDialog";
import MappingTemplateManager from "../components/migration/MappingTemplateManager";
import { usePermissions } from "../components/auth/usePermissions";
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
  const { can, fleetRole } = usePermissions();

  const [step, setStep] = useState(1);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [validatedRows, setValidatedRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isBackgroundJob, setIsBackgroundJob] = useState(false);
  const [jobId, setJobId] = useState(null);
  const rowsPerPage = 50;

  const queryClient = useQueryClient();

  // Check access permission
  if (!can.accessMigration) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
          <Lock className="w-16 h-16 text-rose-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-600 mb-4">
            You do not have permission to access the Service History Migration module.
          </p>
          <p className="text-sm text-slate-500">
            Required role: <strong>FleetAdmin</strong> or <strong>WorkshopOps</strong>
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Your current role: <strong>{fleetRole || "Viewer"}</strong>
          </p>
        </div>
      </div>
    );
  }

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["importBatches"],
    queryFn: () => base44.entities.ImportBatch.list("-created_date", 50),
  });

  const { data: importedRows = [], refetch: refetchRows } = useQuery({
    queryKey: ["importedRows", selectedBatch?.id],
    queryFn: () => base44.entities.ImportedServiceRow.filter({ import_batch_id: selectedBatch.id }),
    enabled: !!selectedBatch && step === 4,
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
        batchId: selectedBatch.id,
        rows,
        mapping,
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.isBackgroundJob) {
        setIsBackgroundJob(true);
        setJobId(data.jobId);
      } else {
        setValidatedRows(data.validatedRows);
        setSummary(data.summary);
      }
      setStep(4);
    },
  });

  const updateRowMutation = useMutation({
    mutationFn: async ({ rowId, updateData }) => {
      const response = await base44.functions.invoke("processServiceImport", {
        action: "updateRow",
        rowId,
        updateData,
      });
      return response.data;
    },
    onSuccess: () => {
      refetchRows();
      setEditingRowId(null);
      setEditingRow(null);
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
    onSuccess: (data) => {
      if (data.isBackgroundJob) {
        setIsBackgroundJob(true);
        setJobId(data.jobId);
        setCommitDialogOpen(false);
      } else {
        queryClient.invalidateQueries({ queryKey: ["importBatches"] });
        setCommitDialogOpen(false);
        setStep(1);
        setSelectedBatch(null);
        setParsedData([]);
        setMapping({});
        setValidatedRows([]);
      }
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

  const handleEditRow = (row) => {
    setEditingRowId(row.id);
    setEditingRow({ ...row });
  };

  const handleSaveRow = () => {
    if (!editingRow) return;
    
    const updateData = {
      mapped_asset_code: editingRow.mapped_asset_code,
      mapped_vehicle_id: editingRow.mapped_vehicle_id,
      mapped_service_date: editingRow.mapped_service_date,
      mapped_odometer_km: editingRow.mapped_odometer_km,
      mapped_workshop_name: editingRow.mapped_workshop_name,
      mapped_service_type: editingRow.mapped_service_type,
      mapped_labour_cost: editingRow.mapped_labour_cost,
      mapped_parts_cost: editingRow.mapped_parts_cost,
      mapped_total_cost: editingRow.mapped_total_cost,
      mapped_notes: editingRow.mapped_notes,
      resolution_status: editingRow.mapped_vehicle_id ? "Ready" : editingRow.resolution_status,
    };

    updateRowMutation.mutate({ rowId: editingRowId, updateData });
  };

  const handleMarkIgnored = (rowId) => {
    updateRowMutation.mutate({
      rowId,
      updateData: { resolution_status: "Ignored" },
    });
  };

  const handleSelectVehicle = (vehicle) => {
    if (editingRow) {
      setEditingRow({
        ...editingRow,
        mapped_vehicle_id: vehicle.id,
        mapped_asset_code: vehicle.asset_code,
      });
    }
    setVehicleSearchOpen(false);
  };

  // Filter and paginate rows
  const { filteredRows, paginatedRows } = useMemo(() => {
    let rows = importedRows.length > 0 ? importedRows : validatedRows;

    // Apply status filter
    if (statusFilter !== "all") {
      rows = rows.filter(r => r.resolution_status === statusFilter);
    }

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.mapped_asset_code?.toLowerCase().includes(term) ||
        r.mapped_workshop_name?.toLowerCase().includes(term) ||
        r.resolution_notes?.toLowerCase().includes(term)
      );
    }

    // Paginate
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedRows = rows.slice(startIndex, startIndex + rowsPerPage);

    return { filteredRows: rows, paginatedRows };
  }, [importedRows, validatedRows, statusFilter, searchTerm, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);

  // Calculate summary from imported rows
  const calculatedSummary = useMemo(() => {
    const rows = importedRows.length > 0 ? importedRows : validatedRows;
    return {
      total: rows.length,
      mapped: rows.filter(r => r.resolution_status === "Mapped").length,
      vehicleNotFound: rows.filter(r => r.resolution_status === "VehicleNotFound").length,
      invalidData: rows.filter(r => r.resolution_status === "InvalidData").length,
      duplicate: rows.filter(r => r.resolution_status === "Duplicate").length,
      ready: rows.filter(r => r.resolution_status === "Ready").length,
      ignored: rows.filter(r => r.resolution_status === "Ignored").length,
    };
  }, [importedRows, validatedRows]);

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
              <div className="mb-4">
                <MappingTemplateManager
                  currentMapping={mapping}
                  onApplyTemplate={(template) => setMapping(template)}
                />
              </div>
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
      {step === 4 && (
        <div className="space-y-6">
          {isBackgroundJob && (
            <Alert className="bg-blue-50 border-blue-200">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <AlertDescription>
                Processing large file in background. Check batch status in the import batches list.
                Job ID: {jobId}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card
              className={`cursor-pointer transition-all ${statusFilter === "all" ? "ring-2 ring-indigo-600" : "hover:shadow-md"}`}
              onClick={() => setStatusFilter("all")}
            >
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-slate-900">{calculatedSummary.total}</p>
                <p className="text-sm text-slate-600">Total Rows</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${statusFilter === "Mapped" ? "ring-2 ring-emerald-600" : "hover:shadow-md"}`}
              onClick={() => setStatusFilter("Mapped")}
            >
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-emerald-600">{calculatedSummary.mapped}</p>
                <p className="text-sm text-slate-600">Mapped</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${statusFilter === "Ready" ? "ring-2 ring-blue-600" : "hover:shadow-md"}`}
              onClick={() => setStatusFilter("Ready")}
            >
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-blue-600">{calculatedSummary.ready}</p>
                <p className="text-sm text-slate-600">Ready</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${statusFilter === "VehicleNotFound" ? "ring-2 ring-rose-600" : "hover:shadow-md"}`}
              onClick={() => setStatusFilter("VehicleNotFound")}
            >
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-rose-600">{calculatedSummary.vehicleNotFound}</p>
                <p className="text-sm text-slate-600">Not Found</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${statusFilter === "Duplicate" ? "ring-2 ring-violet-600" : "hover:shadow-md"}`}
              onClick={() => setStatusFilter("Duplicate")}
            >
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-violet-600">{calculatedSummary.duplicate}</p>
                <p className="text-sm text-slate-600">Duplicates</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${statusFilter === "Ignored" ? "ring-2 ring-slate-600" : "hover:shadow-md"}`}
              onClick={() => setStatusFilter("Ignored")}
            >
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-slate-600">{calculatedSummary.ignored}</p>
                <p className="text-sm text-slate-600">Ignored</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Validation Results</CardTitle>
                  <CardDescription>
                    Review and edit mapped rows. Ready rows will be committed.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Asset Code</TableHead>
                      <TableHead>Service Date</TableHead>
                      <TableHead>Odometer</TableHead>
                      <TableHead>Workshop</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row) => {
                      const isEditing = editingRowId === row.id;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>{getStatusBadge(row.resolution_status)}</TableCell>
                          <TableCell>
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editingRow.mapped_asset_code || ""}
                                  onChange={(e) => setEditingRow({ ...editingRow, mapped_asset_code: e.target.value })}
                                  className="w-32"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setVehicleSearchOpen(true)}
                                  title="Search Vehicle"
                                >
                                  <Search className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="font-medium">{row.mapped_asset_code}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editingRow.mapped_service_date || ""}
                                onChange={(e) => setEditingRow({ ...editingRow, mapped_service_date: e.target.value })}
                                className="w-36"
                              />
                            ) : (
                              row.mapped_service_date
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editingRow.mapped_odometer_km || ""}
                                onChange={(e) => setEditingRow({ ...editingRow, mapped_odometer_km: parseFloat(e.target.value) })}
                                className="w-24"
                              />
                            ) : (
                              row.mapped_odometer_km || "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={editingRow.mapped_workshop_name || ""}
                                onChange={(e) => setEditingRow({ ...editingRow, mapped_workshop_name: e.target.value })}
                                className="w-32"
                              />
                            ) : (
                              row.mapped_workshop_name || "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Select
                                value={editingRow.mapped_service_type || "Unscheduled"}
                                onValueChange={(val) => setEditingRow({ ...editingRow, mapped_service_type: val })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                                  <SelectItem value="Unscheduled">Unscheduled</SelectItem>
                                  <SelectItem value="Breakdown">Breakdown</SelectItem>
                                  <SelectItem value="HireProviderService">Hire Provider</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              row.mapped_service_type || "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editingRow.mapped_total_cost || ""}
                                onChange={(e) => setEditingRow({ ...editingRow, mapped_total_cost: parseFloat(e.target.value) })}
                                className="w-24"
                              />
                            ) : (
                              `$${row.mapped_total_cost || 0}`
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                            {row.resolution_notes}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={handleSaveRow} disabled={updateRowMutation.isPending}>
                                    <Save className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingRowId(null)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => handleEditRow(row)}>
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  {row.resolution_status !== "Ignored" && (
                                    <Button size="sm" variant="ghost" onClick={() => handleMarkIgnored(row.id)}>
                                      <Ban className="w-3 h-3" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-slate-600">
                    Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length} rows
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
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
              {can.commitMigrationBatch ? (
                <Button
                  onClick={() => setCommitDialogOpen(true)}
                  className="bg-indigo-600"
                  disabled={calculatedSummary.mapped === 0 && calculatedSummary.ready === 0}
                >
                  Commit {calculatedSummary.mapped + calculatedSummary.ready + (includeDuplicates ? calculatedSummary.duplicate : 0)} Records
                </Button>
              ) : (
                <Button
                  disabled
                  className="bg-slate-400"
                  title="FleetAdmin role required to commit batches"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Commit (FleetAdmin Only)
                </Button>
              )}
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
              This will create {calculatedSummary.mapped + calculatedSummary.ready} {includeDuplicates ? `+ ${calculatedSummary.duplicate} duplicate` : ""} service records.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {!can.commitMigrationBatch && (
            <Alert className="bg-rose-50 border-rose-200">
              <Lock className="w-4 h-4 text-rose-600" />
              <AlertDescription className="text-rose-800">
                You do not have permission to commit migration batches. Only FleetAdmin users can perform this action.
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Ensure you have reviewed all mapped records. Historical data will be permanently added to Fleet IQ.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommitDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCommit}
              disabled={commitMutation.isPending || !can.commitMigrationBatch}
              className="bg-indigo-600"
            >
              {commitMutation.isPending ? "Committing..." : "Confirm Commit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Search Dialog */}
      <VehicleSearchDialog
        open={vehicleSearchOpen}
        onClose={() => setVehicleSearchOpen(false)}
        onSelect={handleSelectVehicle}
      />
    </div>
  );
}