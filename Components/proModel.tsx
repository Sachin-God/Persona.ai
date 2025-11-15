"use client";

import { DialogTitle } from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader
} from "./ui/dialog";
import { useProModal } from "@/hooks/use-pro-model";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { toast } from "sonner";
import axios from "axios";
import { useEffect, useState } from "react";

export const ProModal = () => {
  const proModal = useProModal();
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, [])

  if (!isMounted) return null;
  // we used above code because it causes hydration Errors

  const onSubscribe = async () => {
    try {
      setLoading(true);

      const response = await axios.get("/api/stripe");

      window.location.href = response.data.url;
    } catch (error) {
      toast.warning("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={proModal.isOpen} onOpenChange={proModal.onClose}>
      <DialogContent>
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-center">
            Upgrade to pro
          </DialogTitle>
          <DialogDescription className="text-center space-y-2">
            Create
            <span className="text-sky-500 font-medium mx-1">Custom AI</span>
            Companions!
          </DialogDescription>

          <Separator />

          <div className="flex justify-between">
            <p className="text-2xl font-medium">
              $9
              <span className="text-sm font-normal">
                .99 / mo
              </span>
            </p>

            <Button disabled={loading} onClick={onSubscribe} variant="premium">
              Subscribe
            </Button>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
