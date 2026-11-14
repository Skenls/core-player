import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Loader2, Pause, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useSynapseMix } from '@/hooks/useSynapseMix';
import { useSynapseStore } from '@/store/synapseStore';
import { usePlayerStore } from '@/store/playerStore';
import { SynapseFilters } from './SynapseFilters';
import { SynapseTrackRow } from './SynapseTrackRow';
import type { SynapseTrack } from '@/types/synapse';
import './synapse.css';

export function SynapseSection() {
  const { filters, setFilters } = useSynapseStore();
  const { data, isFetching, error, refetch } = useSynapseMix();
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const tracks = data?.tracks ?? [];
  const currentSynapse = currentTrack as SynapseTrack | null;
  const playingSynapse = Boolean(currentSynapse?.synapse && isPlaying);
  const animating = playingSynapse && visible && pageVisible;
  const currentInMix = tracks.findIndex(track => track.id === currentTrack?.id && track.synapse.session_id === currentSynapse?.synapse?.session_id);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (sectionRef.current) observer.observe(sectionRef.current);
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  const playTrack = (index: number) => {
    const player = usePlayerStore.getState();
    if (currentInMix === index) { player.togglePlayPause(); return; }
    player.setQueue(tracks, index);
    player.play();
  };
  const playAll = () => {
    if (currentInMix >= 0) usePlayerStore.getState().togglePlayPause();
    else if (tracks.length) playTrack(0);
  };
  const selected = filters.familiarity.length > 0;
  const unavailable = data?.status === 'unavailable';
  const syncing = data?.status === 'syncing' || data?.status === 'learning';

  return <section ref={sectionRef} className={`synapse ${animating ? 'is-playing' : ''}`} aria-labelledby="synapse-title">
    <div className="synapse-ambient" aria-hidden="true" />
    <div className="synapse-topline"><span><Sparkles size={15} aria-hidden="true" /> ПЕРСОНАЛЬНАЯ ВОЛНА</span><span className="synapse-live"><i />{playingSynapse ? 'Сейчас звучит' : 'Настроена на вас'}</span></div>
    <div className="synapse-layout">
      <div className="synapse-hero">
        <div className="synapse-orbit" aria-hidden="true">
          <div className="synapse-orbit-ring ring-one" /><div className="synapse-orbit-ring ring-two" /><div className="synapse-orbit-ring ring-three" />
          <div className="synapse-orb"><div className="synapse-orb-core" /><svg viewBox="0 0 240 240"><defs><radialGradient id="synapse-sphere"><stop stopColor="#efe5ff" stopOpacity=".7" /><stop offset="1" stopColor="#9779ff" stopOpacity=".05" /></radialGradient></defs><circle cx="120" cy="120" r="96" fill="url(#synapse-sphere)" />{Array.from({ length: 13 }, (_, i) => <ellipse key={i} cx="120" cy="120" rx={12 + i * 7} ry="96" fill="none" stroke="#e7dbff" strokeWidth=".6" opacity=".35" transform={`rotate(${i * 14} 120 120)`} />)}</svg></div>
          <span className="synapse-orbit-spark spark-one" /><span className="synapse-orbit-spark spark-two" /><span className="synapse-orbit-spark spark-three" />
        </div>
        <div className="synapse-heading"><span className="synapse-eyebrow">ВАШ ВКУС. НОВЫЕ СВЯЗИ.</span><h2 id="synapse-title">Synapse<span>.</span></h2>
          <p>Знакомые треки и будущие любимые.<br />Музыка, которая находит вас.</p></div>
        <div className="synapse-actions"><button type="button" className="synapse-primary" disabled={!tracks.length || !selected} onClick={playAll}>
          {currentInMix >= 0 && isPlaying ? <Pause size={19} fill="currentColor" aria-hidden="true" /> : <Play size={19} fill="currentColor" aria-hidden="true" />}
          {currentInMix >= 0 && isPlaying ? 'Приостановить' : 'Слушать волну'}
        </button><button type="button" className="synapse-refresh" onClick={() => void refetch()} disabled={isFetching || !selected} aria-label="Обновить подборку" title="Обновить подборку"><RefreshCw size={19} className={isFetching ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" /></button></div>
      </div>
      <div className="synapse-mix">
        <div className="synapse-mix-heading"><h3>В вашей волне</h3><span>{tracks.length ? `${tracks.length} треков` : 'Только для вас'} <ArrowUpRight size={14} aria-hidden="true" /></span></div>
        <div className="synapse-tracklist scrollbar-thin" aria-busy={isFetching}>
          {!selected ? <div className="synapse-empty"><Sparkles size={28} aria-hidden="true" /><h4>Какую музыку найдём?</h4><p>Выберите знакомое, открытия или избранное.</p></div>
            : error ? <div className="synapse-empty" role="status"><h4>Волна пока недоступна</h4><p>Не удалось загрузить подборку. Попробуйте обновить её.</p><button type="button" className="synapse-chip" onClick={() => void refetch()}>Попробовать снова</button></div>
            : !tracks.length ? <div className="synapse-empty" role="status">{isFetching || syncing ? <Loader2 size={28} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles size={28} aria-hidden="true" />}<h4>{isFetching || syncing ? 'Знакомимся с вашей библиотекой' : unavailable ? 'Библиотека пока недоступна' : 'Пока нет подходящих треков'}</h4><p>{isFetching || syncing ? 'Первая волна появится после синхронизации.' : unavailable ? 'Попробуйте обновить подборку позднее.' : 'Попробуйте другие фильтры или добавьте музыку в избранное.'}</p></div>
            : tracks.map((track, index) => <SynapseTrackRow key={`${track.synapse.session_id}-${track.id}`} track={track} index={index} active={index === currentInMix} playing={isPlaying} onPlay={() => playTrack(index)} />)}
        </div>
        {data?.hint && <p className="synapse-hint" role="status">{data.hint}</p>}
        {syncing && tracks.length > 0 && <p className="synapse-hint">Библиотека синхронизируется. Подборка пока ограничена.</p>}
        <div className="synapse-mix-footer"><span className="synapse-small-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span><span>Учится на том, что вы слушаете здесь</span></div>
      </div>
    </div>
    <SynapseFilters filters={filters} onChange={setFilters} />
    <div className="synapse-bottom"><span>Каждое прослушивание — новая связь</span><a href="#home-library">Ваша библиотека <ArrowDown size={13} aria-hidden="true" /></a></div>
  </section>;
}
