"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CharacterAlignmentResponseModel } from "@elevenlabs/elevenlabs-js/api/types/CharacterAlignmentResponseModel"

export interface TranscriptWord {
  kind: "word"
  text: string
  segmentIndex: number
  startTime: number
  endTime: number
}

export interface TranscriptGap {
  kind: "gap"
  text: string
  segmentIndex: number
}

export type TranscriptSegment = TranscriptWord | TranscriptGap

export type SegmentComposer = (
  alignment: CharacterAlignmentResponseModel
) => TranscriptSegment[]

export interface UseTranscriptViewerResult {
  audioRef: React.RefObject<HTMLAudioElement | null>
  segments: TranscriptSegment[]
  spokenSegments: TranscriptSegment[]
  unspokenSegments: TranscriptSegment[]
  currentWord: TranscriptWord | null
  currentTime: number
  duration: number
  isPlaying: boolean
  play: () => void
  pause: () => void
  seekToTime: (time: number) => void
  startScrubbing: () => void
  endScrubbing: () => void
}

function defaultSegmentComposer(
  alignment: CharacterAlignmentResponseModel
): TranscriptSegment[] {
  const chars = alignment.characters ?? []
  const startTimes = alignment.characterStartTimesSeconds ?? []
  const endTimes = alignment.characterEndTimesSeconds ?? []

  const segments: TranscriptSegment[] = []
  let wordStart = 0
  let segmentIndex = 0

  for (let i = 0; i <= chars.length; i++) {
    const isEnd = i === chars.length
    const isSpace = !isEnd && chars[i] === " "

    if (isEnd || isSpace) {
      const wordChars = chars.slice(wordStart, i)
      const text = wordChars.join("")

      if (text.trim()) {
        segments.push({
          kind: "word",
          text,
          segmentIndex: segmentIndex++,
          startTime: startTimes[wordStart] ?? 0,
          endTime: endTimes[i - 1] ?? 0,
        })
      }

      if (isSpace) {
        segments.push({
          kind: "gap",
          text: " ",
          segmentIndex: segmentIndex++,
        })
      }

      wordStart = i + 1
    }
  }

  return segments
}

interface UseTranscriptViewerOptions {
  alignment: CharacterAlignmentResponseModel
  segmentComposer?: SegmentComposer
  hideAudioTags?: boolean
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  onDurationChange?: (duration: number) => void
}

export function useTranscriptViewer({
  alignment,
  segmentComposer,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationChange,
}: UseTranscriptViewerOptions): UseTranscriptViewerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const isScrubbing = useRef(false)

  const segments = useMemo(() => {
    const composer = segmentComposer ?? defaultSegmentComposer
    return composer(alignment)
  }, [alignment, segmentComposer])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      if (!isScrubbing.current) {
        setCurrentTime(audio.currentTime)
        onTimeUpdate?.(audio.currentTime)
      }
    }
    const handleDurationChange = () => {
      setDuration(audio.duration || 0)
      onDurationChange?.(audio.duration || 0)
    }
    const handlePlay = () => {
      setIsPlaying(true)
      onPlay?.()
    }
    const handlePause = () => {
      setIsPlaying(false)
      onPause?.()
    }
    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [onPlay, onPause, onTimeUpdate, onEnded, onDurationChange])

  const wordSegments = useMemo(
    () => segments.filter((s): s is TranscriptWord => s.kind === "word"),
    [segments]
  )

  const currentWord = useMemo(() => {
    return (
      wordSegments.find(
        (w) => currentTime >= w.startTime && currentTime < w.endTime
      ) ?? null
    )
  }, [wordSegments, currentTime])

  const spokenSegments = useMemo(() => {
    if (!currentWord) {
      const lastSpokenWord = [...wordSegments]
        .reverse()
        .find((w) => w.endTime <= currentTime)
      if (!lastSpokenWord) return []
      const cutoff = lastSpokenWord.segmentIndex
      return segments.filter((s) => s.segmentIndex <= cutoff)
    }
    return segments.filter((s) => s.segmentIndex < currentWord.segmentIndex)
  }, [segments, wordSegments, currentWord, currentTime])

  const unspokenSegments = useMemo(() => {
    if (!currentWord) {
      const firstUnspokenWord = wordSegments.find(
        (w) => w.startTime > currentTime
      )
      if (!firstUnspokenWord) return []
      return segments.filter((s) => s.segmentIndex >= firstUnspokenWord.segmentIndex)
    }
    return segments.filter((s) => s.segmentIndex > currentWord.segmentIndex)
  }, [segments, wordSegments, currentWord, currentTime])

  const play = useCallback(() => {
    audioRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const seekToTime = useCallback((time: number) => {
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  const startScrubbing = useCallback(() => {
    isScrubbing.current = true
  }, [])

  const endScrubbing = useCallback(() => {
    isScrubbing.current = false
  }, [])

  return {
    audioRef,
    segments,
    spokenSegments,
    unspokenSegments,
    currentWord,
    currentTime,
    duration,
    isPlaying,
    play,
    pause,
    seekToTime,
    startScrubbing,
    endScrubbing,
  }
}
