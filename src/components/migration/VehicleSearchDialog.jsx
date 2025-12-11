import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function VehicleSearchDialog({ open, onClose, onSelect }) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const filteredVehicles = useMemo(() => {
    if (!searchTerm) return vehicles.slice(0, 20);
    
    const term = searchTerm.toLowerCase();
    return vehicles.filter(v =>
      v.asset_code?.toLowerCase().includes(term) ||
      v.rego?.toLowerCase().includes(term) ||
      v.vin?.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [vehicles, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Search Vehicle
          </DialogTitle>
          <DialogDescription>
            Search by Asset Code, Registration, or VIN
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Asset Code</TableHead>
                  <TableHead>Rego</TableHead>
                  <TableHead>VIN</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">{vehicle.asset_code}</TableCell>
                    <TableCell>{vehicle.rego || "-"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{vehicle.vin || "-"}</TableCell>
                    <TableCell className="text-sm">{vehicle.asset_type}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelect(vehicle)}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredVehicles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      No vehicles found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}