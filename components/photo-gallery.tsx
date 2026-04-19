"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PhotoUpload } from "@/components/photo-upload"
import { useIssueStore } from "@/lib/issue-store"
import { type Photo, type PhotoStage, PHOTO_STAGE_OPTIONS } from "@/lib/types"
import { Camera, ChevronDown, ChevronUp, X, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhotoGalleryProps {
  issueId: string
  photos: Photo[]
  allowAdd?: boolean
}

const STAGE_COLORS: Record<PhotoStage, string> = {
  "是正前": "bg-destructive/10 text-destructive border border-destructive/20",
  "是正中": "bg-warning/20 text-warning-foreground border border-warning/30",
  "是正後": "bg-success/10 text-success border border-success/20",
}

const STAGE_BG: Record<PhotoStage, string> = {
  "是正前": "ring-2 ring-destructive/30",
  "是正中": "ring-2 ring-warning/30",
  "是正後": "ring-2 ring-success/30",
}

export function PhotoGallery({ issueId, photos, allowAdd = true }: PhotoGalleryProps) {
  const { addPhoto } = useIssueStore()
  const [showAddPhoto, setShowAddPhoto] = useState(false)
  const [selectedStage, setSelectedStage] = useState<PhotoStage>("是正後")
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  // ステージごとにグルーピング
  const groupedPhotos = PHOTO_STAGE_OPTIONS.reduce((acc, stage) => {
    acc[stage] = photos.filter(p => p.stage === stage)
    return acc
  }, {} as Record<PhotoStage, Photo[]>)

  const handleAddPhoto = (url: string | undefined) => {
    if (url) {
      addPhoto(issueId, { url, stage: selectedStage })
      setShowAddPhoto(false)
    }
  }

  const hasPhotos = photos.length > 0
  const hasBefore = groupedPhotos["是正前"].length > 0
  const hasAfter = groupedPhotos["是正後"].length > 0
  const showComparison = hasBefore && hasAfter

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
            <Camera className="w-4 h-4" />
            写真
          </CardTitle>
          {allowAdd && (
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setShowAddPhoto(!showAddPhoto)}
            >
              {showAddPhoto ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  閉じる
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-1" />
                  追加
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* 写真追加UI */}
        {showAddPhoto && (
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">ステージを選択</p>
              <div className="flex gap-2">
                {PHOTO_STAGE_OPTIONS.map((stage) => (
                  <Button
                    key={stage}
                    variant={selectedStage === stage ? "default" : "outline"}
                    size="sm"
                    className="h-12 flex-1"
                    onClick={() => setSelectedStage(stage)}
                  >
                    {stage}
                  </Button>
                ))}
              </div>
            </div>
            <PhotoUpload
              onChange={handleAddPhoto}
              label={`${selectedStage}の写真`}
            />
          </div>
        )}

        {/* Before/After 比較表示 */}
        {showComparison && (
          <div className="mb-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2 text-center font-medium">
              Before / After 比較
            </p>
            <div className="flex items-center gap-2">
              {/* Before */}
              <div className="flex-1">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className={cn("px-2 py-0.5 text-xs font-medium rounded", STAGE_COLORS["是正前"])}>
                    是正前
                  </span>
                </div>
                <button
                  className={cn(
                    "relative w-full aspect-square rounded-lg overflow-hidden bg-muted",
                    STAGE_BG["是正前"]
                  )}
                  onClick={() => setExpandedImage(groupedPhotos["是正前"][0].url)}
                >
                  <Image
                    src={groupedPhotos["是正前"][0].url}
                    alt="是正前の写真"
                    fill
                    className="object-cover"
                  />
                </button>
              </div>
              
              {/* Arrow */}
              <ArrowRight className="w-6 h-6 text-muted-foreground shrink-0" />
              
              {/* After */}
              <div className="flex-1">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className={cn("px-2 py-0.5 text-xs font-medium rounded", STAGE_COLORS["是正後"])}>
                    是正後
                  </span>
                </div>
                <button
                  className={cn(
                    "relative w-full aspect-square rounded-lg overflow-hidden bg-muted",
                    STAGE_BG["是正後"]
                  )}
                  onClick={() => setExpandedImage(groupedPhotos["是正後"][0].url)}
                >
                  <Image
                    src={groupedPhotos["是正後"][0].url}
                    alt="是正後の写真"
                    fill
                    className="object-cover"
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 写真表示（ステージ別） */}
        {hasPhotos ? (
          <div className="flex flex-col gap-4">
            {PHOTO_STAGE_OPTIONS.map((stage) => {
              const stagePhotos = groupedPhotos[stage]
              if (stagePhotos.length === 0) return null
              
              // 比較表示で既に表示済みの場合は最初の1枚をスキップ
              const displayPhotos = showComparison && (stage === "是正前" || stage === "是正後")
                ? stagePhotos.slice(1)
                : stagePhotos
              
              // 表示する写真がなければスキップ
              if (displayPhotos.length === 0 && showComparison) {
                return null
              }
              
              return (
                <div key={stage}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "px-2 py-1 text-xs font-medium rounded",
                      STAGE_COLORS[stage]
                    )}>
                      {stage}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stagePhotos.length}枚
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(showComparison && (stage === "是正前" || stage === "是正後") ? displayPhotos : stagePhotos).map((photo) => (
                      <button
                        key={photo.id}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden bg-muted focus:outline-none",
                          STAGE_BG[stage]
                        )}
                        onClick={() => setExpandedImage(photo.url)}
                      >
                        <Image
                          src={photo.url}
                          alt={`${stage}の写真`}
                          fill
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">写真がありません</p>
          </div>
        )}

        {/* 拡大表示 */}
        {expandedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setExpandedImage(null)}
          >
            <button
              className="absolute top-4 right-4 p-3 bg-white/10 rounded-full"
              onClick={() => setExpandedImage(null)}
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <div className="relative w-full max-w-2xl aspect-square">
              <Image
                src={expandedImage}
                alt="拡大写真"
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
