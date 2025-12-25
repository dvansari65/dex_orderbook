import { useInitializeOpenOrder } from "@/api/initialise-open-order";
import { useState } from "react";
import { toast } from "sonner";


export const OpenOrderModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { mutateAsync, isPending } = useInitializeOpenOrder();

  const handleInitialize = async () => {
    try {
      const tx = await mutateAsync();
      if(!tx){
        onClose(); // Close modal after initialization
        toast.error("Open order is not initialise because signature not obtain!")
      }
      toast.success("Open Order initialized successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to initialize Open Order: " + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg p-6 w-[400px]">
        <h2 className="text-lg font-bold mb-4">Initialize Open Order</h2>
        <p className="mb-6">
          Your Open Order account is not initialized. Click the button below to create it on-chain.
        </p>
        <button
          className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
          onClick={handleInitialize}
          disabled={isPending}
        >
          {isPending ? "Initializing..." : "Initialize Open Order"}
        </button>
        <button className="ml-4 text-gray-500" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};
