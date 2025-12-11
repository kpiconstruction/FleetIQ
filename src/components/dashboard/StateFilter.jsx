import React from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

const states = ["All", "VIC", "NSW", "QLD"];

export default function StateFilter({ selected, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <MapPin className="w-4 h-4 text-slate-400" />
      {states.map((state) => (
        <Button
          key={state}
          variant={selected === state ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(state)}
          className={`rounded-full px-4 ${
            selected === state
              ? "bg-indigo-600 hover:bg-indigo-700"
              : "hover:bg-slate-100"
          }`}
        >
          {state}
        </Button>
      ))}
    </div>
  );
}