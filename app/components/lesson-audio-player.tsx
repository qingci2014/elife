"use client";

import { useEffect, useRef, useState } from "react";

type AudioLine = {
  id: number;
  part: "A" | "B";
  speaker: string;
  text: string;
  src: string;
  duration: number;
};

type AudioManifest = {
  title: string;
  fullSrc: string;
  lines: AudioLine[];
};

const rates = [0.75, 0.9, 1, 1.15, 1.25];
function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function LessonAudioPlayer({ lessonNumber, bookNumber }: { lessonNumber: number; bookNumber: number }) {
  const lessonKey = `lesson-${lessonNumber.toString().padStart(2, "0")}`;
  const bookKey = `book-${bookNumber.toString().padStart(2, "0")}`;
  const manifestUrl = `/audio/${bookKey}/${lessonKey}/manifest.json`;
  const [manifest, setManifest] = useState<AudioManifest | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<"dialogue" | "shadow">("dialogue");
  const [rate, setRate] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [loopLine, setLoopLine] = useState(false);
  const fullAudioRef = useRef<HTMLAudioElement>(null);
  const lineAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    clearFollowTimer();
    lineAudioRef.current?.pause();
    fullAudioRef.current?.pause();
    setManifest(null);
    setLoadError(false);
    setCurrentIndex(0);
    setRunning(false);
    setWaiting(false);

    fetch(manifestUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Audio manifest failed to load");
        return response.json() as Promise<AudioManifest>;
      })
      .then(setManifest)
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoadError(true);
      });

    const savedRate = Number(window.localStorage.getItem("english-audio-rate"));
    if (rates.includes(savedRate)) setRate(savedRate);

    return () => controller.abort();
  }, [manifestUrl]);

  useEffect(() => {
    if (fullAudioRef.current) fullAudioRef.current.playbackRate = rate;
    if (lineAudioRef.current) lineAudioRef.current.playbackRate = rate;
    window.localStorage.setItem("english-audio-rate", String(rate));
  }, [rate]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function clearFollowTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopShadowing() {
    clearFollowTimer();
    lineAudioRef.current?.pause();
    setRunning(false);
    setWaiting(false);
  }

  function switchMode(nextMode: "dialogue" | "shadow") {
    fullAudioRef.current?.pause();
    stopShadowing();
    setMode(nextMode);
  }

  function playLine(index: number) {
    if (!manifest) return;
    clearFollowTimer();
    setCurrentIndex(index);
    setWaiting(false);
    setRunning(true);

    window.requestAnimationFrame(() => {
      const audio = lineAudioRef.current;
      if (!audio) return;
      audio.src = manifest.lines[index].src;
      audio.playbackRate = rate;
      audio.currentTime = 0;
      audio.play().catch(() => setRunning(false));
    });
  }

  function handleLineEnded() {
    if (!manifest) return;
    const audio = lineAudioRef.current;
    if (loopLine && audio) {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    if (currentIndex >= manifest.lines.length - 1) {
      setRunning(false);
      setWaiting(false);
      return;
    }

    const line = manifest.lines[currentIndex];
    const followTime = Math.max(2200, Math.round((line.duration / rate) * 1100));
    setWaiting(true);
    timerRef.current = setTimeout(() => playLine(currentIndex + 1), followTime);
  }

  const currentLine = manifest?.lines[currentIndex];
  const totalDuration = manifest?.lines.reduce((total, line) => total + line.duration, 0) ?? 0;

  return (
    <section className="audio-lab" aria-labelledby="lesson-audio-heading">
      <div className="audio-lab-heading">
        <div>
          <p className="eyebrow">LISTEN &amp; SHADOW</p>
          <h2 id="lesson-audio-heading">第{lessonNumber}课配音</h2>
        </div>
        <span className="audio-duration">{manifest?.lines.length ?? "—"}句 · 约 {formatTime(totalDuration)}</span>
      </div>

      <div className="audio-mode-tabs" aria-label="播放方式">
        <button className={mode === "dialogue" ? "active" : ""} onClick={() => switchMode("dialogue")} type="button">
          正常对话
        </button>
        <button className={mode === "shadow" ? "active" : ""} onClick={() => switchMode("shadow")} type="button">
          逐句跟读
        </button>
      </div>

      <div className="audio-speed" aria-label="播放速度">
        <span>速度</span>
        {rates.map((option) => (
          <button
            aria-pressed={rate === option}
            className={rate === option ? "active" : ""}
            key={option}
            onClick={() => setRate(option)}
            type="button"
          >
            {option}×
          </button>
        ))}
      </div>

      {loadError ? <p className="audio-error">音频信息加载失败，请刷新页面后重试。</p> : null}

      {mode === "dialogue" ? (
        <div className="dialogue-player">
          <p>先完整听一遍，不看译文；第二遍再对照课文。</p>
          <audio
            controls
            onPlay={() => stopShadowing()}
            preload="metadata"
            ref={fullAudioRef}
            src={manifest?.fullSrc ?? `/audio/${bookKey}/${lessonKey}/dialogue.wav`}
          >
            你的浏览器不支持音频播放。
          </audio>
        </div>
      ) : (
        <div className="shadow-player">
          <div className="shadow-controls">
            <button className="shadow-primary" onClick={() => running || waiting ? stopShadowing() : playLine(currentIndex)} type="button">
              {running || waiting ? "暂停跟读" : currentIndex === 0 ? "开始跟读" : "继续跟读"}
            </button>
            <button
              aria-pressed={loopLine}
              className={loopLine ? "active" : ""}
              onClick={() => setLoopLine((value) => !value)}
              type="button"
            >
              单句循环
            </button>
            <span aria-live="polite" className={waiting ? "follow-status waiting" : "follow-status"}>
              {waiting ? "轮到你跟读" : currentLine ? `第 ${currentLine.id} 句 · ${currentLine.speaker}` : "正在加载"}
            </span>
          </div>

          <audio onEnded={handleLineEnded} preload="metadata" ref={lineAudioRef} />

          <div className="shadow-script">
            {manifest?.lines.map((line, index) => (
              <button
                className={index === currentIndex ? "shadow-line active" : "shadow-line"}
                key={line.id}
                onClick={() => playLine(index)}
                type="button"
              >
                <span className={`speaker speaker-${line.speaker.toLowerCase()}`}>{line.speaker}</span>
                <span>{line.text}</span>
                <small>{formatTime(line.duration)}</small>
              </button>
            )) ?? <p className="audio-loading">正在加载逐句音频……</p>}
          </div>
        </div>
      )}
    </section>
  );
}
