import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "../components/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Fuel, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  Search,
  Save,
  Lock,
} from "lucide-react";
import VehicleSearchDialog from "../components/migration/VehicleSearchDialog";
import MappingTemplateManager from "../components/migration/MappingTemplateManager";

export default function FuelImport() {
  const { can, isFleetAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [mappingTemplate, setMappingTemplate] = useState(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [vehicleSearchRow, setVehicleSearchRow] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingRow, setEditingRow] = useState(null);

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ['fuelImportBatches'],
    queryFn: () => base44.entities.FuelImportBatch.list('-created_date', 50),
  });

  // Fetch rows for selected batch
  const { data: rows = [], refetch: refetchRows } = useQuery({
    queryKey: ['importedFuelRows', selectedBatchId],
    queryFn: () => base44.entities.ImportedFuelRow.filter({ fuel_import_batch_id: selectedBatchId }),
    enabled: !!selectedBatchId,
  });

  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId);
  }, [batches, selectedBatchId]);

  // Upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file) => {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      const parseResponse = await base44.functions.invoke('parseFuelCardUpload', {
        file_url: uploadResponse.file_url,
        file_name: file.name,
        source_system: 'FleetCardCSV',
        mapping_template: mappingTemplate,
      });
      return parseResponse.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fuelImportBatches'] });
      setSelectedBatchId(data.batch_id);
      setCurrentStep(2);
    },
    onError: (error) => {
      setUploadError(error.message);
    },
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('processFuelImport', {
      action: 'validateAndMap',
      batch_id: selectedBatchId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importedFuelRows'] });
      queryClient.invalidateQueries({ queryKey: ['fuelImportBatches'] });
      setCurrentStep(3);
    },
  });

  // Update row mutation
  const updateRowMutation = useMutation({
    mutationFn: ({ row_id, row_data }) => base44.functions.invoke('processFuelImport', {
      action: 'updateRow',
      row_id,
      row_data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importedFuelRows'] });
    },
  });

  // Commit mutation
  const commitMutation = useMutation({
    mutationFn: () => base44.functions.invoke('processFuelImport', {
      action: 'commit',
      batch_id: selectedBatchId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuelImportBatches'] });
      queryClient.invalidateQueries({ queryKey: ['importedFuelRows'] });
      setCurrentStep(4);
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setUploading(true);
    setUploadError(null);

    try {
      await uploadFileMutation.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  const handleApplyMapping = (template) => {
    setMappingTemplate(template);
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      await validateMutation.mutateAsync();
    } finally {
      setValidating(false);
    }
  };

  const handleResolveVehicle = (row) => {
    setVehicleSearchRow(row);
  };

  const handleVehicleSelected = async (vehicle) => {
    await updateRowMutation.mutateAsync({
      row_id: vehicleSearchRow.id,
      row_data: {
        mapped_vehicle_id: vehicle.id,
        resolution_status: 'Ready',
        resolution_notes: `Manually resolved to ${vehicle.asset_code} (${vehicle.rego})`,
      },
    });
    setVehicleSearchRow(null);
  };

  const handleMarkIgnored = async (row) => {
    await updateRowMutation.mutateAsync({
      row_id: row.id,
      row_data: {
        resolution_status: 'Ignored',
        resolution_notes: 'Marked as ignored by user',
      },
    });
  };

  const handleCommit = async () => {
    if (!confirm(`Commit ${readyRows.length} fuel transactions to FuelTransaction?\n\nThis cannot be undone.`)) {
      return;
    }

    setCommitting(true);
    try {
      await commitMutation.mutateAsync();
    } finally {
      setCommitting(false);
    }
  };

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts = {
      total: rows.length,
      Ready: 0,
      VehicleNotFound: 0,
      InvalidData: 0,
      Duplicate: 0,
      Ignored: 0,
      Committed: 0,
      Unmapped: 0,
      Mapped: 0,
    };

    rows.forEach(row => {
      counts[row.resolution_status] = (counts[row.resolution_status] || 0) + 1;
    });

    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter(r => r.resolution_status === statusFilter);
  }, [rows, statusFilter]);

  const readyRows = rows.filter(r => r.resolution_status === 'Ready');

  // Permission check
  if (!can.uploadMigrationData) {
    return (
      <div className="p-6 lg:p-8">
        <Alert className="bg-rose-50 border-rose-200">
          <Lock className="w-4 h-4 text-rose-600" />
          <AlertDescription className="text-rose-800">
            You don't have permission to access fuel imports. Only FleetAdmin and WorkshopOps can import fuel data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Fuel className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Fuel Card Import
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Import fuel transactions from fleet card CSV/Excel exports
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[1, 2, 3, 4].map(step => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                currentStep >= step
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-400"
              }`}
            >
              {step}
            </div>
            <span className={currentStep >= step ? "font-medium" : "text-slate-400"}>
              {step === 1 && "Upload"}
              {step === 2 && "Map Columns"}
              {step === 3 && "Validate & Resolve"}
              {step === 4 && "Commit"}
            </span>
            {step < 4 && <div className="w-16 h-1 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Upload Fuel Card File</CardTitle>
            <CardDescription>
              Upload a CSV or Excel file exported from your fleet card provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-lg font-medium text-indigo-600 hover:text-indigo-700">
                  Choose a file
                </span>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </Label>
              <p className="text-sm text-slate-500 mt-2">CSV or Excel (max 50MB)</p>
            </div>

            {uploading && (
              <Alert className="bg-blue-50 border-blue-200">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Uploading and parsing file...
                </AlertDescription>
              </Alert>
            )}

            {uploadError && (
              <Alert className="bg-rose-50 border-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <AlertDescription className="text-rose-800">{uploadError}</AlertDescription>
              </Alert>
            )}

            {/* Recent Batches */}
            {batches.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Recent Imports</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.slice(0, 10).map(batch => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.file_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            batch.status === 'Committed' ? 'bg-emerald-50 text-emerald-700' :
                            batch.status === 'ReadyToCommit' ? 'bg-blue-50 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }>
                            {batch.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{batch.summary_json?.total_rows || 0}</TableCell>
                        <TableCell>
                          {new Date(batch.created_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {batch.status !== 'Committed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedBatchId(batch.id);
                                setCurrentStep(batch.status === 'Uploaded' ? 2 : 3);
                              }}
                            >
                              Continue
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {currentStep === 2 && selectedBatch && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>
              Map CSV columns to fuel transaction fields • File: {selectedBatch.file_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <MappingTemplateManager
              entityType="fuel"
              onApplyTemplate={handleApplyMapping}
            />

            {rows.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Sample Data (first 5 rows)</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Card Number</TableHead>
                        <TableHead>Rego</TableHead>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Litres</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Site</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{row.mapped_card_number || '-'}</TableCell>
                          <TableCell>{row.mapped_rego || '-'}</TableCell>
                          <TableCell>
                            {row.mapped_transaction_datetime 
                              ? new Date(row.mapped_transaction_datetime).toLocaleString()
                              : '-'}
                          </TableCell>
                          <TableCell>{row.mapped_litres || '-'}</TableCell>
                          <TableCell>${row.mapped_total_cost_ex_gst || 0}</TableCell>
                          <TableCell>{row.mapped_site_location || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleValidate}
                disabled={validating}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {validating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Validate & Continue
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Validate & Resolve */}
      {currentStep === 3 && selectedBatch && (
        <div className="space-y-6">
          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(statusCounts).filter(([key]) => key !== 'total').map(([status, count]) => (
              <Card
                key={status}
                className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-indigo-600' : ''}`}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              >
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">{status}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Rows Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Review & Resolve</CardTitle>
              <CardDescription>
                {filteredRows.length} of {statusCounts.total} rows {statusFilter !== 'all' && `(filtered: ${statusFilter})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card/Rego</TableHead>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Litres</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{row.mapped_card_number || '-'}</p>
                            <p className="text-slate-500">{row.mapped_rego || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.mapped_transaction_datetime 
                            ? new Date(row.mapped_transaction_datetime).toLocaleString()
                            : '-'}
                        </TableCell>
                        <TableCell>{row.mapped_litres?.toFixed(1) || '-'}L</TableCell>
                        <TableCell>${row.mapped_total_cost_ex_gst?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-sm">{row.mapped_site_location || '-'}</TableCell>
                        <TableCell>
                          {row.mapped_vehicle_id ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700">
                              Unresolved
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            row.resolution_status === 'Ready' ? 'bg-emerald-50 text-emerald-700' :
                            row.resolution_status === 'VehicleNotFound' ? 'bg-amber-50 text-amber-700' :
                            row.resolution_status === 'InvalidData' ? 'bg-rose-50 text-rose-700' :
                            row.resolution_status === 'Duplicate' ? 'bg-orange-50 text-orange-700' :
                            row.resolution_status === 'Ignored' ? 'bg-slate-100 text-slate-600' :
                            'bg-blue-50 text-blue-700'
                          }>
                            {row.resolution_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.resolution_status === 'VehicleNotFound' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolveVehicle(row)}
                            >
                              <Search className="w-3 h-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                          {(row.resolution_status === 'InvalidData' || row.resolution_status === 'Duplicate') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkIgnored(row)}
                            >
                              Ignore
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Back to Mapping
            </Button>
            <Button
              onClick={handleCommit}
              disabled={committing || readyRows.length === 0 || !isFleetAdmin}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {committing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Committing...
                </>
              ) : !isFleetAdmin ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Commit ({readyRows.length})
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Commit {readyRows.length} Transactions
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {currentStep === 4 && selectedBatch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="w-6 h-6" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-emerald-50 border-emerald-200">
              <AlertDescription className="text-emerald-800">
                <p className="font-semibold mb-2">
                  Successfully imported {selectedBatch.summary_json?.committed || 0} fuel transactions
                </p>
                <p className="text-sm">
                  Total: {selectedBatch.summary_json?.total_litres?.toLocaleString() || 0}L • 
                  ${selectedBatch.summary_json?.total_cost?.toLocaleString() || 0}
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep(1);
                  setSelectedBatchId(null);
                }}
              >
                Import Another File
              </Button>
              <Button
                onClick={() => window.location.href = '/Fuel'}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                View Fuel Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Search Dialog */}
      {vehicleSearchRow && (
        <VehicleSearchDialog
          open={!!vehicleSearchRow}
          onOpenChange={() => setVehicleSearchRow(null)}
          onVehicleSelected={handleVehicleSelected}
        />
      )}
    </div>
  );
}