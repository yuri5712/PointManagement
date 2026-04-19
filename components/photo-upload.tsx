"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Camera, X } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface PhotoUploadProps {
  value?: string
  onChange: (value: string | undefined) => void
  label: string
  className?: string
  compact?: boolean
}

export function PhotoUpload({ value, onChange, label, className, compact = false }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        onChange(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleRemove = () => {
    onChange(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  if (value) {
    return (
      <div className={cn("relative", className)}>
        <div className={cn(
          "relative rounded-lg overflow-hidden bg-muted",
          compact ? "aspect-square" : "aspect-[4/3]"
        )}>
          <Image
            src={value}
            alt={label}
            fill
            className="object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-12 w-12"
            onClick={handleRemove}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2 text-center">{label}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full border-2 border-dashed flex flex-col items-center justify-center gap-2",
          compact ? "aspect-square h-auto" : "aspect-[4/3] h-auto min-h-[140px]"
        )}
        onClick={handleClick}
      >
        <Camera className="h-10 w-10 text-muted-foreground" />
        <span className="text-base text-muted-foreground">タップして撮影</span>
      </Button>
      <p className="text-sm text-muted-foreground mt-2 text-center">{label}</p>
    </div>
  )
}
