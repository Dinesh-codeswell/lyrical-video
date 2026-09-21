import React, { useState } from 'react';
import type { Theme } from '../../types';
import { THEME_PRESETS, VISUAL_EFFECTS } from '../../types';
import { 
  FolderPlus, Palette, Type, Wand2, Mic2, SlidersHorizontal, 
  ChevronLeft, ChevronRight, X, Smartphone, Monitor, Square, 
  AlignLeft, AlignCenter, AlignRight, Check, Sparkles
} from 'lucide-react';
import { SongSelector } from './SongSelector';
import './StudioDrawer.css';

export type StudioTab = 'media' | 'presets' | 'effects' | 'text' | 'motion' | 'karaoke' | 'canvas';

interface StudioDrawerProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  selectedSong: string | null;
  onSongSelect: (slug: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab?: StudioTab;
  onTabChange?: (tab: StudioTab) => void;
}

export const StudioDrawer: React.FC<StudioDrawerProps> = ({
  theme,
  onThemeChange,
  selectedSong,
  onSongSelect,
  isOpen,
  onToggleOpen,
  activeTab: controlledTab,
  onTabChange
}) => {
  const [internalTab, setInternalTab] = useState<StudioTab>('media');
  const [effectCategory, setEffectCategory] = useState<'all' | 'color' | 'texture' | 'retro'>('all');
  const currentTab = controlledTab || internalTab;

  const handleSelectTab = (tab: StudioTab) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);

    if (!isOpen) {
      onToggleOpen();
    }
  };

  const handleChange = (key: keyof Theme, value: any) => {
    onThemeChange({ ...theme, [key]: value });
  };

  const handleApplyPreset = (presetTheme: Partial<Theme>) => {
    onThemeChange({
      ...theme,
      ...presetTheme,
      aspect_ratio: theme.aspect_ratio, // Preserve aspect ratio
    });
  };

  const handleGradientChange = (index: number, value: number) => {
    const newGrad = [...theme.inactive_text_opacity_gradient];
    newGrad[index] = value;
    handleChange('inactive_text_opacity_gradient', newGrad);
  };

  return (
    <div className={`studio-drawer-wrapper ${isOpen ? 'drawer-open' : 'drawer-collapsed'}`}>
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. Primary Tool Rail (56px Icon Column)                           */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <nav className="studio-tool-rail">
        <div className="tool-rail-top">
          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'media' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('media')}
            title="Project Media & Import"
          >
            <FolderPlus size={18} />
            <span className="rail-tab-label">Media</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'presets' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('presets')}
            title="Curated Style Presets"
          >
            <Palette size={18} />
            <span className="rail-tab-label">Presets</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'effects' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('effects')}
            title="Visual Effects, Film Filters & Shaders"
          >
            <Sparkles size={18} />
            <span className="rail-tab-label">Effects</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'text' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('text')}
            title="Typography & Text Styling"
          >
            <Type size={18} />
            <span className="rail-tab-label">Text</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'motion' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('motion')}
            title="Motion & Animation Engine"
          >
            <Wand2 size={18} />
            <span className="rail-tab-label">Motion</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'karaoke' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('karaoke')}
            title="Karaoke Timing & Glow"
          >
            <Mic2 size={18} />
            <span className="rail-tab-label">Karaoke</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'canvas' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('canvas')}
            title="Canvas, Aspect Ratio & Brand"
          >
            <SlidersHorizontal size={18} />
            <span className="rail-tab-label">Canvas</span>
          </button>
        </div>

        <div className="tool-rail-bottom">
          <button 
            type="button"
            className="rail-collapse-btn"
            onClick={onToggleOpen}
            title={isOpen ? "Collapse Studio Panel" : "Expand Studio Panel"}
          >
            {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </nav>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. Drawer Content Panel (Focused section view)                    */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <aside className="studio-drawer-panel">
        {/* Panel Header */}
        <div className="drawer-panel-header">
          <div className="drawer-title-group">
            {currentTab === 'media' && (
              <>
                <h3 className="drawer-title">Media & Import</h3>
                <span className="drawer-badge">{selectedSong ? selectedSong : 'Library'}</span>
              </>
            )}
            {currentTab === 'presets' && (
              <>
                <h3 className="drawer-title">Curated Presets</h3>
                <span className="drawer-badge">{THEME_PRESETS.length} Styles</span>
              </>
            )}
            {currentTab === 'effects' && (
              <>
                <h3 className="drawer-title">Effects & Filters</h3>
                <span className="drawer-badge">{theme.active_filter.toUpperCase()}</span>
              </>
            )}
            {currentTab === 'text' && (
              <>
                <h3 className="drawer-title">Typography & Text</h3>
                <span className="drawer-badge">{theme.font_family}</span>
              </>
            )}
            {currentTab === 'motion' && (
              <>
                <h3 className="drawer-title">Motion Engine</h3>
                <span className="drawer-badge">{theme.animation_style.toUpperCase()}</span>
              </>
            )}
            {currentTab === 'karaoke' && (
              <>
                <h3 className="drawer-title">Karaoke & Glow</h3>
                <span className="drawer-badge">{theme.highlight_mode.toUpperCase()}</span>
              </>
            )}
            {currentTab === 'canvas' && (
              <>
                <h3 className="drawer-title">Canvas & Brand</h3>
                <span className="drawer-badge">{theme.aspect_ratio}</span>
              </>
            )}
          </div>

          <button 
            type="button" 
            className="drawer-close-btn"
            onClick={onToggleOpen}
            title="Close Panel"
          >
            <X size={15} />
          </button>
        </div>

        {/* Panel Body */}
        <div className="drawer-panel-body">
          {/* TAB 1: MEDIA & IMPORT */}
          {currentTab === 'media' && (
            <div className="drawer-section media-tab-content">
              <SongSelector onSelect={onSongSelect} />
            </div>
          )}

          {/* TAB 2: CURATED PRESETS */}
          {currentTab === 'presets' && (
            <div className="drawer-section presets-tab-content">
              <p className="section-instruction">
                Click any aesthetic preset to instantly update typography, highlight colors, and background.
              </p>
              <div className="presets-vertical-grid">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = theme.name === preset.name || 
                    (theme.active_text_color === preset.theme.active_text_color && 
                     theme.background_color === preset.theme.background_color);
                  return (
                    <div 
                      key={preset.id}
                      className={`preset-card-pro ${isSelected ? 'active' : ''}`}
                      onClick={() => handleApplyPreset(preset.theme)}
                    >
                      <div className="preset-card-info">
                        <div className="preset-card-headline">
                          <span className="preset-name">{preset.name}</span>
                          <span className="preset-badge-tag">{preset.badge}</span>
                        </div>
                        <p className="preset-description">{preset.description}</p>
                      </div>

                      <div className="preset-card-actions">
                        <div className="preset-swatches-pro">
                          <span 
                            className="swatch-circle" 
                            style={{ backgroundColor: preset.theme.background_color }} 
                            title="Background Color" 
                          />
                          <span 
                            className="swatch-circle" 
                            style={{ backgroundColor: preset.theme.text_color }} 
                            title="Text Color" 
                          />
                          <span 
                            className="swatch-circle active-circle" 
                            style={{ 
                              backgroundColor: preset.theme.active_text_color,
                              boxShadow: preset.theme.active_glow_color ? `0 0 6px ${preset.theme.active_glow_color}` : 'none'
                            }} 
                            title="Active Glow" 
                          />
                        </div>
                        {isSelected && (
                          <div className="preset-active-check">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: VISUAL EFFECTS & SHADERS */}
          {currentTab === 'effects' && (
            <div className="drawer-section effects-tab-content">
              {/* Category Filter Pills */}
              <div className="effects-category-filter">
                {(['all', 'color', 'texture', 'retro'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill-btn ${effectCategory === cat ? 'active' : ''}`}
                    onClick={() => setEffectCategory(cat)}
                  >
                    {cat === 'all' ? 'All Filters' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              {/* Filter Intensity Slider */}
              {theme.active_filter !== 'none' && (
                <div className="control-group">
                  <div className="group-header-flex">
                    <label className="group-label">Filter Intensity</label>
                    <span className="group-value-pill">{theme.filter_intensity || 80}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={theme.filter_intensity || 80}
                    onChange={(e) => handleChange('filter_intensity', parseInt(e.target.value))}
                    className="pro-range"
                  />
                </div>
              )}

              {/* Vignette Toggle */}
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Cinematic Lens Vignette</div>
                  <div className="toggle-desc">Darken outer frame edges to focus lyrics</div>
                </div>
                <input
                  type="checkbox"
                  checked={theme.vignette_enabled || false}
                  onChange={(e) => handleChange('vignette_enabled', e.target.checked)}
                  className="pro-switch"
                />
              </div>

              {/* Ambient Dynamic Particles */}
              <div className="control-group">
                <label className="group-label">Ambient Particle Shaders</label>
                <div className="segmented-particle-selector">
                  {[
                    { id: 'none', label: 'Off' },
                    { id: 'starfield', label: 'Starfield' },
                    { id: 'dust-motes', label: 'Dust Motes' },
                    { id: 'audio-pulse', label: 'Pulse Wave' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`particle-pill-btn ${theme.ambient_particles === p.id ? 'active' : ''}`}
                      onClick={() => handleChange('ambient_particles', p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Effects & Shaders Grid */}
              <div className="effects-grid">
                {VISUAL_EFFECTS.filter(e => effectCategory === 'all' || e.category === effectCategory).map((effect) => {
                  const isActive = theme.active_filter === effect.id;
                  return (
                    <div
                      key={effect.id}
                      className={`effect-card ${isActive ? 'selected' : ''}`}
                      onClick={() => handleChange('active_filter', effect.id)}
                    >
                      <div 
                        className="effect-preview-swatch"
                        style={{ background: effect.previewGradient }}
                      >
                        <span className="effect-category-badge">{effect.tag}</span>
                        {isActive && (
                          <div className="effect-check-indicator">
                            <Check size={14} />
                          </div>
                        )}
                      </div>

                      <div className="effect-info">
                        <div className="effect-name">{effect.name}</div>
                        <div className="effect-desc">{effect.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TYPOGRAPHY & TEXT */}
          {currentTab === 'text' && (
            <div className="drawer-section text-tab-content">
              {/* Font Family */}
              <div className="control-group">
                <label className="group-label">Font Family</label>
                <select 
                  value={theme.font_family} 
                  onChange={(e) => handleChange('font_family', e.target.value)}
                  className="pro-select"
                >
                  <option value="Arial">Arial (Clean Sans)</option>
                  <option value="Inter">Inter (Modern Geometric)</option>
                  <option value="Roboto">Roboto (Android / Google)</option>
                  <option value="JetBrains Mono">JetBrains Mono (Code/Tech)</option>
                  <option value="Georgia">Georgia (Editorial Serif)</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Font Size</label>
                  <span className="group-value-pill">{theme.font_size}px</span>
                </div>
                <input 
                  type="range" 
                  min="24" 
                  max="144" 
                  value={theme.font_size} 
                  onChange={(e) => handleChange('font_size', parseInt(e.target.value))} 
                  className="pro-range"
                />
              </div>

              {/* Alignment */}
              <div className="control-group">
                <label className="group-label">Text Alignment</label>
                <div className="segmented-align-buttons">
                  <button 
                    type="button"
                    className={`align-btn ${theme.lyric_position === 'left' ? 'active' : ''}`}
                    onClick={() => handleChange('lyric_position', 'left')}
                    title="Align Left"
                  >
                    <AlignLeft size={16} />
                    <span>Left</span>
                  </button>
                  <button 
                    type="button"
                    className={`align-btn ${theme.lyric_position === 'center' ? 'active' : ''}`}
                    onClick={() => handleChange('lyric_position', 'center')}
                    title="Align Center"
                  >
                    <AlignCenter size={16} />
                    <span>Center</span>
                  </button>
                  <button 
                    type="button"
                    className={`align-btn ${theme.lyric_position === 'right' ? 'active' : ''}`}
                    onClick={() => handleChange('lyric_position', 'right')}
                    title="Align Right"
                  >
                    <AlignRight size={16} />
                    <span>Right</span>
                  </button>
                </div>
              </div>

              {/* Primary Text Color */}
              <div className="control-group">
                <label className="group-label">Main Text Color</label>
                <div className="color-picker-row">
                  <input 
                    type="color" 
                    value={theme.text_color} 
                    onChange={(e) => handleChange('text_color', e.target.value)} 
                    className="pro-color-swatch"
                  />
                  <input 
                    type="text" 
                    value={theme.text_color} 
                    onChange={(e) => handleChange('text_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* Line & Letter Spacing */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Line Spacing</label>
                  <span className="group-value-pill">{theme.line_spacing.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="3.0" 
                  step="0.1" 
                  value={theme.line_spacing} 
                  onChange={(e) => handleChange('line_spacing', parseFloat(e.target.value))} 
                  className="pro-range"
                />
              </div>

              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Letter Spacing</label>
                  <span className="group-value-pill">{theme.letter_spacing}px</span>
                </div>
                <input 
                  type="range" 
                  min="-10" 
                  max="50" 
                  step="1" 
                  value={theme.letter_spacing} 
                  onChange={(e) => handleChange('letter_spacing', parseInt(e.target.value))} 
                  className="pro-range"
                />
              </div>

              {/* Text Stroke */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Active Stroke Width</label>
                  <span className="group-value-pill">{theme.active_text_stroke_width}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="20" 
                  value={theme.active_text_stroke_width} 
                  onChange={(e) => handleChange('active_text_stroke_width', parseInt(e.target.value))} 
                  className="pro-range"
                />
                <div className="color-picker-row mt-2">
                  <span className="sub-label">Stroke Color:</span>
                  <input 
                    type="color" 
                    value={theme.active_text_stroke_color} 
                    onChange={(e) => handleChange('active_text_stroke_color', e.target.value)} 
                    className="pro-color-swatch-sm"
                  />
                  <input 
                    type="text" 
                    value={theme.active_text_stroke_color} 
                    onChange={(e) => handleChange('active_text_stroke_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MOTION & ANIMATION */}
          {currentTab === 'motion' && (
            <div className="drawer-section motion-tab-content">
              <label className="group-label mb-2">Animation Engine</label>
              
              <div className="motion-styles-list">
                {[
                  { id: 'scroll', name: 'Continuous Scroll', badge: 'Classic', desc: 'Continuous smooth vertical roll synced to audio' },
                  { id: 'typewriter', name: 'Typewriter', badge: 'Retro', desc: 'Real-time letter typing effect with blinking cursor' },
                  { id: 'kinetic', name: 'Kinetic Pop', badge: 'Modern', desc: 'Punchy elastic bounce-in on each active line' },
                  { id: 'fade', name: 'Minimalist Fade', badge: 'Clean', desc: 'Subtle vertical rise with soft smooth opacity fade' },
                  { id: 'slide', name: 'Dynamic Slide', badge: 'Energetic', desc: 'Lateral entrance with high-speed deceleration' },
                ].map((style) => (
                  <div 
                    key={style.id}
                    className={`motion-style-card ${theme.animation_style === style.id ? 'active' : ''}`}
                    onClick={() => handleChange('animation_style', style.id)}
                  >
                    <div className="motion-card-top">
                      <span className="motion-name">{style.name}</span>
                      <span className="motion-badge">{style.badge}</span>
                    </div>
                    <p className="motion-desc">{style.desc}</p>
                  </div>
                ))}
              </div>

              {/* Speed Multiplier */}
              <div className="control-group mt-4">
                <div className="group-header-flex">
                  <label className="group-label">Motion Speed Multiplier</label>
                  <span className="group-value-pill">{theme.animation_speed.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.2" 
                  max="3.0" 
                  step="0.1" 
                  value={theme.animation_speed} 
                  onChange={(e) => handleChange('animation_speed', parseFloat(e.target.value))} 
                  className="pro-range"
                />
              </div>
            </div>
          )}

          {/* TAB 5: KARAOKE & GLOW */}
          {currentTab === 'karaoke' && (
            <div className="drawer-section karaoke-tab-content">
              {/* Highlight Mode */}
              <div className="control-group">
                <label className="group-label">Highlight Wipe Mode</label>
                <div className="segmented-toggle-3">
                  <button 
                    type="button"
                    className={`toggle-option ${theme.highlight_mode === 'line' ? 'active' : ''}`}
                    onClick={() => handleChange('highlight_mode', 'line')}
                  >
                    Line
                  </button>
                  <button 
                    type="button"
                    className={`toggle-option ${theme.highlight_mode === 'word' ? 'active' : ''}`}
                    onClick={() => handleChange('highlight_mode', 'word')}
                  >
                    Word (Karaoke)
                  </button>
                  <button 
                    type="button"
                    className={`toggle-option ${theme.highlight_mode === 'character' ? 'active' : ''}`}
                    onClick={() => handleChange('highlight_mode', 'character')}
                  >
                    Character
                  </button>
                </div>
              </div>

              {/* Active Text Color */}
              <div className="control-group">
                <label className="group-label">Active Highlight Fill</label>
                <div className="color-picker-row">
                  <input 
                    type="color" 
                    value={theme.active_text_color} 
                    onChange={(e) => handleChange('active_text_color', e.target.value)} 
                    className="pro-color-swatch"
                  />
                  <input 
                    type="text" 
                    value={theme.active_text_color} 
                    onChange={(e) => handleChange('active_text_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* Glow & Bold Styles */}
              <div className="control-group">
                <label className="group-label">Active Styling Effects</label>
                <div className="effects-toggles-row">
                  <label className="pro-checkbox-card">
                    <input 
                      type="checkbox" 
                      checked={theme.active_text_bold} 
                      onChange={(e) => handleChange('active_text_bold', e.target.checked)} 
                    />
                    <span>Bold Weight</span>
                  </label>

                  <label className="pro-checkbox-card">
                    <input 
                      type="checkbox" 
                      checked={theme.active_text_glow} 
                      onChange={(e) => handleChange('active_text_glow', e.target.checked)} 
                    />
                    <span>Neon Glow</span>
                  </label>
                </div>

                {theme.active_text_glow && (
                  <div className="color-picker-row mt-2">
                    <span className="sub-label">Glow Color:</span>
                    <input 
                      type="color" 
                      value={theme.active_glow_color || theme.active_text_color} 
                      onChange={(e) => handleChange('active_glow_color', e.target.value)} 
                      className="pro-color-swatch-sm"
                    />
                    <input 
                      type="text" 
                      value={theme.active_glow_color || theme.active_text_color} 
                      onChange={(e) => handleChange('active_glow_color', e.target.value)} 
                      className="pro-color-hex"
                    />
                  </div>
                )}
              </div>

              {/* Dim Alpha */}
              {(theme.highlight_mode === 'word' || theme.highlight_mode === 'character') && (
                <div className="control-group">
                  <div className="group-header-flex">
                    <label className="group-label">Inactive Word Dimming</label>
                    <span className="group-value-pill">{Math.round(theme.highlight_dim_alpha * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="0.8" 
                    step="0.05" 
                    value={theme.highlight_dim_alpha} 
                    onChange={(e) => handleChange('highlight_dim_alpha', parseFloat(e.target.value))} 
                    className="pro-range"
                  />
                </div>
              )}

              {/* Inactive Lines Gradient */}
              <div className="control-group">
                <label className="group-label">Context Lines Opacity</label>
                {theme.inactive_text_opacity_gradient.map((val, i) => (
                  <div key={i} className="gradient-slider-row">
                    <span className="sub-label">Line ±{i + 1}</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      value={val} 
                      onChange={(e) => handleGradientChange(i, parseFloat(e.target.value))} 
                      className="pro-range"
                    />
                    <span className="group-value-pill">{Math.round(val * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: CANVAS & BRAND */}
          {currentTab === 'canvas' && (
            <div className="drawer-section canvas-tab-content">
              {/* Aspect Ratio */}
              <div className="control-group">
                <label className="group-label">Aspect Ratio</label>
                <div className="aspect-options-grid">
                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '16:9' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '16:9')}
                  >
                    <Monitor size={18} />
                    <span className="aspect-title">16:9</span>
                    <span className="aspect-sub">YouTube / Desktop</span>
                  </button>

                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '9:16' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '9:16')}
                  >
                    <Smartphone size={18} />
                    <span className="aspect-title">9:16</span>
                    <span className="aspect-sub">TikTok / Reels / Shorts</span>
                  </button>

                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '1:1' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '1:1')}
                  >
                    <Square size={18} />
                    <span className="aspect-title">1:1</span>
                    <span className="aspect-sub">Square Feed</span>
                  </button>

                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '4:5' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '4:5')}
                  >
                    <Smartphone size={18} />
                    <span className="aspect-title">4:5</span>
                    <span className="aspect-sub">Instagram Portrait</span>
                  </button>
                </div>
              </div>

              {/* Target FPS */}
              <div className="control-group">
                <label className="group-label">Export Frame Rate (FPS)</label>
                <select 
                  value={theme.fps} 
                  onChange={(e) => handleChange('fps', parseInt(e.target.value))}
                  className="pro-select"
                >
                  <option value={24}>24 FPS (Cinematic Look)</option>
                  <option value={30}>30 FPS (Standard Web Video)</option>
                  <option value={60}>60 FPS (Ultra Smooth Animation)</option>
                </select>
              </div>

              {/* Canvas Background Color */}
              <div className="control-group">
                <label className="group-label">Canvas Background Color</label>
                <div className="color-picker-row">
                  <input 
                    type="color" 
                    value={theme.background_color} 
                    onChange={(e) => handleChange('background_color', e.target.value)} 
                    className="pro-color-swatch"
                  />
                  <input 
                    type="text" 
                    value={theme.background_color} 
                    onChange={(e) => handleChange('background_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* Video Dimmer Overlay */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Background Video Dimmer</label>
                  <span className="group-value-pill">{theme.text_overlay_opacity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={theme.text_overlay_opacity} 
                  onChange={(e) => handleChange('text_overlay_opacity', parseInt(e.target.value))} 
                  className="pro-range"
                />
                <div className="color-picker-row mt-2">
                  <span className="sub-label">Overlay Tint:</span>
                  <input 
                    type="color" 
                    value={theme.text_overlay_color} 
                    onChange={(e) => handleChange('text_overlay_color', e.target.value)} 
                    className="pro-color-swatch-sm"
                  />
                  <input 
                    type="text" 
                    value={theme.text_overlay_color} 
                    onChange={(e) => handleChange('text_overlay_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* Text Column Width */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Text Column Width</label>
                  <span className="group-value-pill">{theme.column_width}px</span>
                </div>
                <input 
                  type="range" 
                  min="400" 
                  max="1920" 
                  step="20" 
                  value={theme.column_width} 
                  onChange={(e) => handleChange('column_width', parseInt(e.target.value))} 
                  className="pro-range"
                />
              </div>

              {/* Logo & Watermark */}
              <div className="control-group">
                <label className="group-label">Brand Logo / Watermark</label>
                <input 
                  type="text" 
                  value={theme.logo_path} 
                  placeholder="e.g. assets/logo.png" 
                  onChange={(e) => handleChange('logo_path', e.target.value)} 
                  className="pro-text-input" 
                />
                {theme.logo_path && (
                  <>
                    <div className="group-header-flex mt-2">
                      <span className="sub-label">Logo Width:</span>
                      <span className="group-value-pill">{theme.logo_width}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="800" 
                      step="10" 
                      value={theme.logo_width} 
                      onChange={(e) => handleChange('logo_width', parseInt(e.target.value))} 
                      className="pro-range"
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
