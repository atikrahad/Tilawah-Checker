"use client";

import { useEffect, useState, useRef } from "react";
import { Mic, Play, Square, Loader2, RefreshCcw, EyeOff, Eye, Headphones } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Surah {
  id: number;
  name_simple: string;
  name_arabic: string;
}

interface Verse {
  id: number;
  verse_key: string;
  text_uthmani: string;
  audio: { url: string };
  translations: { text: string }[];
}

// Ensure Arabic tashkeel are removed for comparison
function stripTashkeel(text: string) {
  // Matches Arabic marks (fatha, damma, kasra, sukun, shadda, etc.)
  return text.replace(/[\u0617-\u061A\u064B-\u0652]/g, "");
}

function normalizeArabicText(text: string) {
  let normalized = stripTashkeel(text);
  // Normalize alif letters
  normalized = normalized.replace(/[أإآا]/g, "ا");
  // Normalize taa marbutah
  normalized = normalized.replace(/ة/g, "ه");
  // Remove punctuation
  normalized = normalized.replace(/[.,،؛؟]/g, "");
  // Compress whitespace
  return normalized.replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
        matrix[i - 1][j - 1] + indicator // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

function isFuzzyMatch(spoken: string, target: string) {
  // Exact match
  if (spoken === target) return true;

  // Check if one contains the other (e.g., "الرحمن" vs "رحمن")
  if (spoken.includes(target) || target.includes(spoken)) {
    if (Math.abs(spoken.length - target.length) <= 3) {
      return true;
    }
  }

  // Levenshtein distance
  const distance = levenshtein(spoken, target);
  // Tolerate 1 error for 3-4 letter words, 2 errors for 5-7, 3 for 8+
  const threshold = target.length <= 4 ? 1 : target.length <= 7 ? 2 : 3;

  return distance <= threshold;
}

export default function Home() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVerses, setLoadingVerses] = useState(false);

  // States for current reading
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isPracticeMode, setIsPracticeMode] = useState(false);

  // States for Listen Mode
  const [activeTab, setActiveTab] = useState<'recite' | 'listen'>('recite');
  const [currentListenVerseIndex, setCurrentListenVerseIndex] = useState(0);
  const listenAudioRef = useRef<HTMLAudioElement | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchSurahs();
    initSpeechRecognition();
  }, []);

  useEffect(() => {
    if (selectedSurah) {
      fetchVerses(selectedSurah);
      setCurrentVerseIndex(0);
      setRecognizedText("");
      setInterimText("");
      stopRecording();
      
      setCurrentListenVerseIndex(0);
    } else {
      setVerses([]);
      setCurrentVerseIndex(0);
      setCurrentListenVerseIndex(0);
      setRecognizedText("");
      setInterimText("");
    }
  }, [selectedSurah, activeTab]);

  const checkVerseComplete = (targetVerse: string, spokenText: string) => {
    const targetWordsRaw = normalizeArabicText(targetVerse).split(" ").filter(w => w.length > 0);
    const spokenWordsRaw = normalizeArabicText(spokenText).split(" ").filter(w => w.length > 0);

    let spokenIndex = 0;
    let matchedCount = 0;

    for (let index = 0; index < targetWordsRaw.length; index++) {
      const targetWord = targetWordsRaw[index];
      let matchFound = false;

      for (let i = 0; i < 3; i++) {
        if (spokenIndex + i < spokenWordsRaw.length) {
          const checkSpoken = spokenWordsRaw[spokenIndex + i];
          if (isFuzzyMatch(checkSpoken, targetWord)) {
            matchFound = true;
            spokenIndex = spokenIndex + i + 1;
            break;
          }
        }
      }

      if (matchFound) {
        matchedCount++;
      } else {
        if (spokenIndex < spokenWordsRaw.length) {
          spokenIndex++;
        }
      }
    }

    return targetWordsRaw.length > 0 && matchedCount === targetWordsRaw.length;
  };

  useEffect(() => {
    if (isRecording && verses[currentVerseIndex]) {
      const isComplete = checkVerseComplete(verses[currentVerseIndex].text_uthmani, recognizedText + interimText);
      if (isComplete) {
        if (isPracticeMode && currentVerseIndex < verses.length - 1) {
          // Auto advance and continue reading in Practice Mode WITHOUT stopping recording
          const timeout = setTimeout(() => {
            setCurrentVerseIndex((prev) => prev + 1);
            setRecognizedText("");
            setInterimText("");
          }, 1000);
          return () => clearTimeout(timeout);
        } else {
          stopRecording();
        }
      }
    }
  }, [recognizedText, interimText, isRecording, currentVerseIndex, verses, isPracticeMode]);





  const initSpeechRecognition = () => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "ar-SA";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            } else {
              interimTranscript += event.results[i][0].transcript + " ";
            }
          }

          if (finalTranscript) {
            setRecognizedText((prev) => prev + finalTranscript);
          }
          setInterimText(interimTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  };

  const fetchSurahs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quran/surahs");
      const data = await res.json();
      setSurahs(data);
      if (data.length > 0) setSelectedSurah(data[0].id);
    } catch (error) {
      console.error("Failed to fetch surahs", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerses = async (surahId: number) => {
    setLoadingVerses(true);
    try {
      const res = await fetch(
        `/api/quran/surahs/${surahId}/verses`
      );
      const data = await res.json();
      setVerses(data.verses || []);
    } catch (error) {
      console.error("Failed to fetch verses", error);
    } finally {
      setLoadingVerses(false);
    }
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      setRecognizedText("");
      setInterimText("");
      recognitionRef.current.start();
      setIsRecording(true);
    } else {
      alert("Speech recognition is not supported in this browser.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audioUrl = `https://verses.quran.com/${url}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play();
  };

  const renderComparison = (targetVerse: string, spokenText: string) => {
    const targetWordsRaw = normalizeArabicText(targetVerse).split(" ").filter(w => w.length > 0);
    const spokenWordsRaw = normalizeArabicText(spokenText).split(" ").filter(w => w.length > 0);

    let spokenIndex = 0;

    return (
      <div
        className="text-right text-3xl leading-loose font-arabic mb-6"
        style={{ fontFamily: "'Uthmani', serif" }}
      >
        {targetWordsRaw.map((targetWord, index) => {
          let matchFound = false;
          let matchedSpokenWord = "";

          // Look ahead up to 3 words
          for (let i = 0; i < 3; i++) {
            if (spokenIndex + i < spokenWordsRaw.length) {
              const checkSpoken = spokenWordsRaw[spokenIndex + i];
              if (isFuzzyMatch(checkSpoken, targetWord)) {
                matchFound = true;
                matchedSpokenWord = checkSpoken;
                spokenIndex = spokenIndex + i + 1; // Advance spokenIndex past the match
                break;
              }
            }
          }

          // If no fuzzy match is found ahead, assume the current spoken word corresponds to this target word
          if (!matchFound && spokenIndex < spokenWordsRaw.length) {
            matchedSpokenWord = spokenWordsRaw[spokenIndex];
            spokenIndex++;
          }

          let colorClass = "text-gray-800 dark:text-gray-200"; // default
          let tooltipText = "";

          if (matchedSpokenWord) {
            if (matchFound) {
              colorClass = "text-emerald-500 font-bold";
            } else {
              colorClass = "text-red-500 font-bold relative group";
              tooltipText = `You said: ${matchedSpokenWord}`;
            }
          }

          return (
            <span key={index} className={`inline-block mx-1 ${colorClass}`}>
              {targetWord}
              {tooltipText && (
                <span className="absolute bottom-full right-0 mb-2 w-max bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {tooltipText}
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const currentVerse = verses[currentVerseIndex];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans transition-colors duration-300">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-zinc-900/70 border-b border-slate-200 dark:border-zinc-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-emerald-500 to-teal-500">
            Tilwah Checker
          </h1>
          <div className="flex items-center gap-4">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            ) : (
              <select
                className="bg-slate-100 dark:bg-zinc-800 border-none rounded-lg py-2 px-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                value={selectedSurah || ""}
                onChange={(e) => setSelectedSurah(Number(e.target.value))}
              >
                <option value="" disabled>Select a Surah</option>
                {surahs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. {s.name_simple} ({s.name_arabic})
                  </option>
                ))}
              </select>
            )}

            {/* Tab Toggles */}
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-full">
              <button
                onClick={() => setActiveTab('recite')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                  activeTab === 'recite' ? "bg-white dark:bg-zinc-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300 hover:text-emerald-500"
                }`}
              >
                <Mic className="w-4 h-4 scale-90" /> Recite
              </button>
              <button
                onClick={() => setActiveTab('listen')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                  activeTab === 'listen' ? "bg-white dark:bg-zinc-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300 hover:text-emerald-500"
                }`}
              >
                <Headphones className="w-4 h-4 scale-90" /> Listen
              </button>
            </div>

            {/* Practice Mode Toggle */}
            {activeTab === 'recite' && (
              <button
                onClick={() => setIsPracticeMode(!isPracticeMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                  isPracticeMode
                    ? "bg-emerald-500 text-white shadow-emerald-500/30 shadow-md"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                }`}
                title="Practice Mode (Hide text before reciting)"
              >
                {isPracticeMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                Practice Mode
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8">
        {activeTab === 'listen' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-zinc-800 flex flex-col items-center justify-center min-h-[400px]"
          >
            {loadingVerses ? (
               <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
            ) : selectedSurah && verses.length > 0 ? (
              <div className="flex flex-col items-center w-full max-w-4xl">
               <div className="flex flex-col items-center w-full max-w-md gap-8 py-10 sticky top-[80px] bg-white dark:bg-zinc-900 z-10 p-4 border-b border-slate-100 dark:border-zinc-800">
                 <Headphones className="w-16 h-16 text-emerald-500 opacity-80 drop-shadow-lg" />
                 <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-emerald-500 to-teal-500">
                    Listen to Surah
                 </h2>
                 <p className="text-slate-500 text-center mb-2">
                    Playing Ayah {verses[currentListenVerseIndex]?.verse_key}
                 </p>
                 <audio 
                   controls 
                   autoPlay 
                   src={`https://verses.quran.com/${verses[currentListenVerseIndex]?.audio?.url}`} 
                   className="w-full mt-4" 
                   ref={listenAudioRef}
                   onEnded={() => {
                     if (currentListenVerseIndex < verses.length - 1) {
                       setCurrentListenVerseIndex(prev => prev + 1);
                     }
                   }}
                 />
               </div>
               
               {verses && verses.length > 0 && (
                 <div className="w-full mt-6 pt-10 px-4 max-w-4xl">
                   {verses.map((verse, index) => {
                     const isPlaying = index === currentListenVerseIndex;
                     
                     return (
                       <div 
                         key={verse.id} 
                         ref={el => {
                           if (isPlaying && el) {
                             el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                           }
                         }}
                         className={`mb-12 p-6 rounded-2xl transition-all duration-500 ${
                           isPlaying 
                             ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 scale-[1.02] shadow-xl shadow-emerald-500/5' 
                             : 'bg-transparent border border-transparent opacity-60'
                         }`}
                         onClick={() => setCurrentListenVerseIndex(index)}
                       >
                         <div className="flex justify-between items-center mb-4 cursor-pointer">
                           <span className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                              isPlaying ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
                           }`}>
                             Ayah {verse.verse_key}
                           </span>
                           {isPlaying && (
                             <div className="flex gap-1" title="Playing now...">
                               <div className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse audio-bar-1"></div>
                               <div className="w-1 h-4 bg-emerald-500 rounded-full animate-pulse audio-bar-2" style={{ animationDelay: '0.2s' }}></div>
                               <div className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse audio-bar-3" style={{ animationDelay: '0.4s' }}></div>
                             </div>
                           )}
                         </div>
                         <p
                           className={`text-right text-3xl leading-loose font-arabic mb-6 transition-colors duration-500 cursor-pointer ${
                             isPlaying ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-800 dark:text-slate-200'
                           }`}
                           style={{ fontFamily: "'Uthmani', serif" }}
                           dir="rtl"
                         >
                           {verse.text_uthmani}
                         </p>
                         {verse.translations && verse.translations[0] && (
                           <p
                             className={`text-right text-base italic transition-colors duration-500 ${
                               isPlaying ? 'text-emerald-600 dark:text-emerald-500/80' : 'text-slate-500 dark:text-slate-400'
                             }`}
                             dangerouslySetInnerHTML={{
                               __html: verse.translations[0].text,
                             }}
                           />
                         )}
                       </div>
                     );
                   })}
                 </div>
               )}
              </div>
            ) : (
               <p className="text-slate-500">Please select a Surah to listen to.</p>
            )}
          </motion.div>
        ) : loadingVerses ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
            <p className="text-slate-500">Loading Verses...</p>
          </div>
        ) : currentVerse ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-zinc-800"
          >
             <div className="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-zinc-800 pb-4">
                <span className="text-sm font-semibold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                  Ayah {currentVerse.verse_key}
                </span>

                <button
                  onClick={() => playAudio(currentVerse.audio.url)}
                  className="p-3 bg-slate-100 hover:bg-emerald-500 hover:text-white dark:bg-zinc-800 dark:hover:bg-emerald-600 rounded-full transition-all group"
                  title="Listen to reference"
                >
                  <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
             </div>

            {/* Original Text display or Comparison */}
            <div dir="rtl" className="mb-8 min-h-[100px] flex flex-col justify-center">
              {recognizedText || interimText ? (
                renderComparison(
                  currentVerse.text_uthmani,
                  recognizedText + interimText
                )
              ) : isPracticeMode ? (
                <p className="text-center text-xl text-slate-400 dark:text-slate-500 italic mt-4">
                  ( Text hidden in Practice Mode. Tap to recite. )
                </p>
              ) : (
                <p
                  className="text-center text-4xl leading-loose font-arabic text-slate-800 dark:text-slate-100"
                  style={{ fontFamily: "'Uthmani', serif" }}
                >
                  {currentVerse.text_uthmani}
                </p>
              )}
            </div>

            {/* Translation */}
            {!isPracticeMode && currentVerse.translations && currentVerse.translations[0] && (
              <p
                className="text-center text-slate-500 dark:text-slate-400 text-lg mb-10 italic"
                dangerouslySetInnerHTML={{
                  __html: currentVerse.translations[0].text,
                }}
              />
            )}

            {/* Controls */}
            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-4">
                <AnimatePresence mode="wait">
                  {!isRecording ? (
                    <motion.button
                      key="start"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={startRecording}
                      className="flex items-center gap-2 bg-linear-to-r from-emerald-500 to-teal-500 text-white px-8 py-4 rounded-full font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-1 transition-all"
                    >
                      <Mic className="w-6 h-6" />
                      Tap to Recite
                    </motion.button>
                  ) : (
                    <motion.button
                      key="stop"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={stopRecording}
                      className="flex items-center gap-2 bg-linear-to-r from-red-500 to-rose-500 text-white px-8 py-4 rounded-full font-semibold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:-translate-y-1 transition-all"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      Stop Recording
                    </motion.button>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => {
                    setRecognizedText("");
                    setInterimText("");
                  }}
                  className="p-4 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Reset"
                >
                  <RefreshCcw className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation */}
              <div className="flex gap-4 w-full justify-between mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800">
                <button
                  disabled={currentVerseIndex === 0}
                  onClick={() => setCurrentVerseIndex((prev) => prev - 1)}
                  className="px-6 py-2 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous Ayah
                </button>
                <button
                  disabled={currentVerseIndex === verses.length - 1}
                  onClick={() => setCurrentVerseIndex((prev) => prev + 1)}
                  className="px-6 py-2 rounded-lg font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next Ayah
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
