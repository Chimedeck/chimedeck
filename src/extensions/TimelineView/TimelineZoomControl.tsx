// TimelineZoomControl — toggle between Day, Week, and Month zoom levels.
// Rendered in the TimelineView toolbar.
import translations from './translations/en.json';
import type { TimelineZoomControlProps, ZoomLevel } from './types';
import Button from '../../common/components/Button';

const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: translations['TimelineView.zoomDay'],
  week: translations['TimelineView.zoomWeek'],
  month: translations['TimelineView.zoomMonth'],
};

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month'];

const TimelineZoomControl = ({ zoom, onZoomChange }: TimelineZoomControlProps) => {
  return (
    <div
      className="flex rounded border border-slate-700"
      role="group"
      aria-label={translations['TimelineView.zoomLabel']}
      data-testid="timeline-zoom-control"
    >
      {ZOOM_LEVELS.map((level, i) => (
        <Button
          key={level}
          variant="ghost"
          onClick={() => onZoomChange(level)}
          aria-pressed={zoom === level}
          data-testid={`timeline-zoom-${level}`}
          className={`px-3 py-1 text-xs rounded-none ${
            i === 0 ? 'rounded-l' : i === ZOOM_LEVELS.length - 1 ? 'rounded-r' : ''
          } ${
            zoom === level
              ? 'bg-blue-600 text-white hover:bg-blue-600' // [theme-exception] active zoom level
              : 'text-subtle hover:text-subtle'
          }`}
        >
          {ZOOM_LABELS[level]}
        </Button>
      ))}
    </div>
  );
};

export default TimelineZoomControl;
