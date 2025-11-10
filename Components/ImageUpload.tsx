"use client"

import { useEffect, useState } from "react";
import {CldUploadButton} from "next-cloudinary"
import Image from "next/image";

interface ImageUploadProps {
    values : string,
    onChange : (src : string) => void;
    disabled ?: boolean;
}

export default function ImageUpload({values, onChange, disabled} : ImageUploadProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, [])

    if (!isMounted) return null;
    // we used above code because it causes hydration Errors
  return (
    <div className="flex flex-col justify-center items-center w-full space-x-4">
      <CldUploadButton 
      onSuccess={(result : any) => onChange(result.info.secure_url)}
      options={{
        maxFiles: 1
      }} uploadPreset="uceyorhi">
        <div className="p-4 border-4 border-dashed border-primary/10 rounded-lg hover:opacity-75 transition flex flex-col space-y-2 items-center justify-center">
            <div className="relative h-40 w-40">
                <Image fill src={values || "/upload_area.png"} alt="upload" className="rounded-lg object-cover"/>
            </div>
        </div>
      </CldUploadButton>
    </div>
  )
}
