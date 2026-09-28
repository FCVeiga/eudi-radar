'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

type LandscapeEntry = { idSystems: { name: string; url: string }[]; companies: { name: string; url: string }[] };

function statusClass(entry: LandscapeEntry | undefined): string {
  if (!entry) return 'data-none';
  const hasSystems = entry.idSystems.length > 0;
  const hasCompanies = entry.companies.length > 0;
  if (hasSystems && hasCompanies) return 'data-full';
  if (hasSystems || hasCompanies) return 'data-partial';
  return 'data-none';
}

export default function LandscapeMap({ data }: { data: Record<string, LandscapeEntry> }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mapRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip) return;

    container.innerHTML = '<div style="color:var(--muted);font-size:12.5px;padding:60px;text-align:center;">Loading world map…</div>';

    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((topology: any) => {
      const geojson: any = topojson.feature(topology, topology.objects.countries);
      const width = 900, height = 460;
      const projection = d3.geoNaturalEarth1().fitSize([width - 20, height - 20], geojson);
      const path = d3.geoPath(projection as any);

      container.innerHTML = '';
      const svg = d3.select(container).append('svg').attr('viewBox', `0 0 ${width} ${height}`);

      svg.append('rect').attr('x', 0).attr('y', 0).attr('width', width).attr('height', height).attr('fill', '#122236');

      svg.selectAll('path')
        .data(geojson.features)
        .join('path')
        .attr('d', path as any)
        .attr('fill', (d: any) => {
          const cls = statusClass(data[d.properties.name]);
          if (cls === 'data-full') return '#4C9A7B';
          if (cls === 'data-partial') return '#C9A227';
          return '#2A3D57';
        })
        .attr('opacity', (d: any) => statusClass(data[d.properties.name]) === 'data-none' ? 1 : 0.75)
        .on('mouseenter', function (event: any, d: any) {
          const entry = data[d.properties.name];
          let html = `<div class="tt-country">${d.properties.name}</div>`;
          html += `<div class="tt-section-label">eIDAS / National ID Systems</div>`;
          if (entry && entry.idSystems.length) {
            html += `<ul style="list-style:none;padding:0;margin:0;">${entry.idSystems.map((s) => `<li style="margin-bottom:3px;"><a href="${s.url}" target="_blank" style="color:var(--brass);">${s.name}</a></li>`).join('')}</ul>`;
          } else {
            html += `<div style="color:var(--muted);font-style:italic;">No system logged yet</div>`;
          }
          html += `<div class="tt-section-label">Wallet-space Companies</div>`;
          if (entry && entry.companies.length) {
            html += `<ul style="list-style:none;padding:0;margin:0;">${entry.companies.map((c) => `<li style="margin-bottom:3px;"><a href="${c.url}" target="_blank" style="color:var(--brass);">${c.name}</a></li>`).join('')}</ul>`;
          } else {
            html += `<div style="color:var(--muted);font-style:italic;">No companies logged yet</div>`;
          }
          tooltip.innerHTML = html;
          tooltip.style.display = 'block';
        })
        .on('mousemove', function (event: any) {
          const rect = container.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          tooltip.style.left = Math.min(x + 16, rect.width - 260) + 'px';
          tooltip.style.top = y + 16 + 'px';
        })
        .on('mouseleave', function () {
          tooltip.style.display = 'none';
        });
    }).catch((err) => {
      container.innerHTML = `<div style="color:var(--muted);padding:60px;text-align:center;">Map data failed to load (requires internet access): ${err}</div>`;
    });
  }, [data]);

  return (
    <>
      <div className="map-legend">
        <span className="legend-item"><span className="legend-dot full"></span>System + companies logged</span>
        <span className="legend-item"><span className="legend-dot partial"></span>Partial data</span>
        <span className="legend-item"><span className="legend-dot none"></span>No data yet</span>
      </div>
      <div className="map-container">
        <div id="world-map" ref={mapRef}></div>
        <div className="map-tooltip" ref={tooltipRef}></div>
      </div>
    </>
  );
}
