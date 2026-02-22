import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useStore, DEMO_LIMITS } from '../store';
import { useToastStore } from '../store-toast';
import { Document, Packer, Paragraph, TextRun } from 'docx';

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

interface ChapterEditorProps {
  focusMode?: boolean;
}

export function ChapterEditor({ focusMode }: ChapterEditorProps) {
  const selectedChapterId = useStore((s) => s.selectedChapterId);
  const setSelectedChapterId = useStore((s) => s.setSelectedChapterId);
  const currentBookId = useStore((s) => s.currentBookId);
  const isDemoUser = useStore((s) => s.isDemoUser);
  const isDemo = isDemoUser;
  const editorFontFamily = useStore((s) => s.editorFontFamily);
  const editorFontSize = useStore((s) => s.editorFontSize);
  const editorLineHeight = useStore((s) => s.editorLineHeight);
  const editorTextMaxWidth = useStore((s) => s.editorTextMaxWidth);
  const autoSaveDelay = useStore((s) => s.autoSaveDelay);
  const setFocusMode = useStore((s) => s.setFocusMode);
  const toast = useToastStore((s) => s.add);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [chapters, setChapters] = useState<{ id: string; title: string; sort_order: number }[]>([]);
  const contentRef = useRef(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = useMemo(() => countWords(content), [content]);
  const charCount = useMemo(() => content.length, [content]);

  useEffect(() => {
    if (!currentBookId) {
      setChapters([]);
      return;
    }
    invoke<{ id: string; title: string; sort_order: number }[]>('get_chapters', { bookId: currentBookId })
      .then(setChapters)
      .catch(console.error);
  }, [currentBookId]);

  const currentIdx = chapters.findIndex((c) => c.id === selectedChapterId);
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1] : null;
  const nextChapter = currentIdx >= 0 && currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null;

  const loadChapter = useCallback(async () => {
    if (!selectedChapterId) {
      setContent('');
      setTitle('');
      return;
    }
    try {
      const chapter = await invoke<{ id: string; title: string; content: string }>('get_chapter', {
        chapterId: selectedChapterId,
      });
      let text = chapter.content || '';
      if (isDemo && text.length > DEMO_LIMITS.charsPerChapter) {
        text = text.slice(0, DEMO_LIMITS.charsPerChapter);
      }
      setContent(text);
      setTitle(chapter.title);
      contentRef.current = text;
    } catch (e) {
      console.error(e);
    }
  }, [selectedChapterId, isDemo]);

  useEffect(() => {
    loadChapter();
  }, [loadChapter]);

  const saveChapter = useCallback(async () => {
    if (!selectedChapterId) return;
    let toSave = contentRef.current;
    if (isDemo && toSave.length > DEMO_LIMITS.charsPerChapter) {
      toSave = toSave.slice(0, DEMO_LIMITS.charsPerChapter);
    }
    setSaveStatus('saving');
    try {
      await invoke('update_chapter_content', {
        chapterId: selectedChapterId,
        content: toSave,
      });
      setSaveStatus('saved');
      toast('Сохранено', 'success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error(e);
      toast('Ошибка сохранения', 'error');
      setSaveStatus('idle');
    }
  }, [selectedChapterId, toast, isDemo]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    if (!selectedChapterId) return;
    const timer = setTimeout(saveChapter, autoSaveDelay);
    return () => clearTimeout(timer);
  }, [content, selectedChapterId, autoSaveDelay, saveChapter]);

  const prevChapterRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevChapterRef.current && prevChapterRef.current !== selectedChapterId) {
      invoke('update_chapter_content', {
        chapterId: prevChapterRef.current,
        content: contentRef.current,
      }).catch(console.error);
    }
    prevChapterRef.current = selectedChapterId;
  }, [selectedChapterId]);

  const exportToDocx = useCallback(async () => {
    const titleToExport = title;
    const contentToExport = contentRef.current;
    if (!titleToExport) return;
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: titleToExport, bold: true })],
              spacing: { after: 400 },
            }),
            ...(contentToExport || '').split('\n').map((line) =>
              new Paragraph({
                children: [new TextRun({ text: line || ' ' })],
                spacing: { after: 200 },
              })
            ),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const path = await save({
        defaultPath: `${titleToExport.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.docx`,
        filters: [{ name: 'Word', extensions: ['docx'] }],
      });
      if (path) {
        await invoke('write_file', { path, contentBase64: base64 });
        toast('Экспорт DOCX выполнен', 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Ошибка экспорта', 'error');
    }
  }, [title, toast]);

  const exportToTxt = useCallback(async () => {
    const titleToExport = title;
    const contentToExport = contentRef.current;
    if (!titleToExport) return;
    try {
      const text = `${titleToExport}\n\n${contentToExport || ''}`;
      const bytes = new TextEncoder().encode(text);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const path = await save({
        defaultPath: `${titleToExport.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.txt`,
        filters: [{ name: 'Текст', extensions: ['txt'] }],
      });
      if (path) {
        await invoke('write_file', { path, contentBase64: base64 });
        toast('Экспорт TXT выполнен', 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Ошибка экспорта', 'error');
    }
  }, [title, toast]);

  const exportToMd = useCallback(async () => {
    const titleToExport = title;
    const contentToExport = contentRef.current;
    if (!titleToExport) return;
    try {
      const md = `# ${titleToExport}\n\n${contentToExport || ''}`;
      const bytes = new TextEncoder().encode(md);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const path = await save({
        defaultPath: `${titleToExport.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (path) {
        await invoke('write_file', { path, contentBase64: base64 });
        toast('Экспорт MD выполнен', 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Ошибка экспорта', 'error');
    }
  }, [title, toast]);

  useEffect(() => {
    const handler = () => exportToDocx();
    window.addEventListener('storyweaver-export-word', handler);
    return () => window.removeEventListener('storyweaver-export-word', handler);
  }, [exportToDocx]);

  useEffect(() => {
    const handler = () => saveChapter();
    window.addEventListener('storyweaver-save-chapter', handler);
    return () => window.removeEventListener('storyweaver-save-chapter', handler);
  }, [saveChapter]);

  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (!text || !textareaRef.current) return;
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = contentRef.current.substring(0, start);
      const after = contentRef.current.substring(end);
      let newContent = before + text + after;
      if (isDemo && newContent.length > DEMO_LIMITS.charsPerChapter) {
        newContent = newContent.slice(0, DEMO_LIMITS.charsPerChapter);
      }
      setContent(newContent);
      contentRef.current = newContent;
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    };
    window.addEventListener('storyweaver-insert-text', handler);
    return () => window.removeEventListener('storyweaver-insert-text', handler);
  }, [isDemo]);

  if (!selectedChapterId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 15,
          background: 'var(--bg-primary)',
        }}
      >
        Выберите главу для редактирования
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        position: 'relative',
      }}
    >
      {!focusMode && (
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => prevChapter && setSelectedChapterId(prevChapter.id)}
            disabled={!prevChapter}
            title="Предыдущая глава"
            style={{
              padding: 6,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: prevChapter ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: prevChapter ? 'pointer' : 'not-allowed',
              fontSize: 14,
            }}
          >
            ‹
          </button>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h2>
          <button
            onClick={() => nextChapter && setSelectedChapterId(nextChapter.id)}
            disabled={!nextChapter}
            title="Следующая глава"
            style={{
              padding: 6,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: nextChapter ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: nextChapter ? 'pointer' : 'not-allowed',
              fontSize: 14,
            }}
          >
            ›
          </button>
        </div>
        <span style={{ fontSize: 12, color: isDemo && charCount >= DEMO_LIMITS.charsPerChapter ? 'var(--error)' : 'var(--text-secondary)' }}>
          {wordCount} слов · {charCount}{isDemo ? `/${DEMO_LIMITS.charsPerChapter}` : ''} симв.
        </span>
        <button
          onClick={saveChapter}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            background: saveStatus === 'saved' ? 'var(--success)' : 'var(--bg-tertiary)',
            color: saveStatus === 'saved' ? 'white' : 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          {saveStatus === 'saving' ? '...' : saveStatus === 'saved' ? '✓' : 'В БД'}
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={exportToDocx}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
            }}
          >
            Сохранить DOCX
          </button>
          <button
            onClick={exportToTxt}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          >
            TXT
          </button>
          <button
            onClick={exportToMd}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          >
            MD
          </button>
        </div>
      </div>
      )}
      {focusMode && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
          <button
            onClick={() => setFocusMode(false)}
            title="Выйти из режима фокуса (Ctrl+Shift+F)"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              opacity: 0.8,
            }}
          >
            Выйти из фокуса
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          const v = e.target.value;
          if (isDemo && v.length > DEMO_LIMITS.charsPerChapter) {
            setContent(v.slice(0, DEMO_LIMITS.charsPerChapter));
          } else {
            setContent(v);
          }
        }}
        placeholder={isDemo ? `Начните писать... (макс. ${DEMO_LIMITS.charsPerChapter} символов)` : 'Начните писать...'}
        style={{
          flex: 1,
          padding: 24,
          margin: 0,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontFamily: editorFontFamily,
          fontSize: editorFontSize,
          lineHeight: editorLineHeight,
          resize: 'none',
          outline: 'none',
          maxWidth: editorTextMaxWidth || undefined,
          marginLeft: editorTextMaxWidth ? 'auto' : undefined,
          marginRight: editorTextMaxWidth ? 'auto' : undefined,
        }}
      />
    </div>
  );
}
