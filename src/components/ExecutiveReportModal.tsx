/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Sparkles, 
  FileText, 
  Calendar
} from 'lucide-react';
import { TrafficTicket } from '../types';

interface ExecutiveReportModalProps {
  tickets: TrafficTicket[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ExecutiveReportModal({ tickets, isOpen, onClose }: ExecutiveReportModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  // Generate HTML executive report string
  const generatedHtml = useMemo(() => {
    const refDate = selectedDate || new Date().toISOString().substring(0, 10);
    
    let dateFormatted = refDate;
    if (refDate.includes('-')) {
      const [y, m, d] = refDate.split('-');
      dateFormatted = `${d}/${m}/${y}`;
    }

    // Filter tickets for selected date or fallback if date is cleared
    let targetTickets = tickets.filter(t => (t.infractionDate || '').substring(0, 10) === refDate);
    if (targetTickets.length === 0 && tickets.length > 0 && !selectedDate) {
      targetTickets = tickets;
    }

    const total = targetTickets.length;

    // Location mapping
    const locationMap: Record<string, { count: number; types: Record<string, number> }> = {};
    const infractionMap: Record<string, { count: number; desc: string; nature: string }> = {};
    
    let gravissimaCount = 0;
    let graveCount = 0;

    targetTickets.forEach(t => {
      const loc = (t.location || 'Centro Urbano / Via Pública').trim();
      if (!locationMap[loc]) {
        locationMap[loc] = { count: 0, types: {} };
      }
      locationMap[loc].count++;
      
      const infType = (t.infractionDescription || t.infractionCode || 'Infração de Trânsito').trim();
      locationMap[loc].types[infType] = (locationMap[loc].types[infType] || 0) + 1;

      if (!infractionMap[infType]) {
        infractionMap[infType] = {
          count: 0,
          desc: t.infractionDescription || infType,
          nature: t.nature || 'Média'
        };
      }
      infractionMap[infType].count++;

      if (t.nature === 'Gravíssima') gravissimaCount++;
      if (t.nature === 'Grave') graveCount++;
    });

    // Sorted locations
    const sortedLocations = Object.entries(locationMap)
      .map(([locName, data]) => {
        let maxType = 'Infração Diversa';
        let maxTypeCount = 0;
        Object.entries(data.types).forEach(([type, c]) => {
          if (c > maxTypeCount) {
            maxTypeCount = c;
            maxType = type;
          }
        });

        // Determine location risk
        let locRisk = 'Baixo';
        if (data.count >= 5) locRisk = 'Crítico';
        else if (data.count >= 3) locRisk = 'Alto';
        else if (data.count >= 2) locRisk = 'Moderado';

        return { locName, count: data.count, predominantType: maxType, locRisk };
      })
      .sort((a, b) => b.count - a.count);

    // Sorted infractions
    const sortedInfractions = Object.entries(infractionMap)
      .map(([type, data]) => ({
        type,
        count: data.count,
        desc: data.desc,
        nature: data.nature
      }))
      .sort((a, b) => b.count - a.count);

    const topLocation = sortedLocations[0]?.locName || (total > 0 ? 'Vias Públicas' : 'Nenhum ponto registrado');
    const topInfraction = sortedInfractions[0]?.type || (total > 0 ? 'Infração de Trânsito' : 'Nenhuma autuação');

    // Risk calculation
    let criticality = 'Baixo';
    let riskBadgeClass = 'baixo';
    if (gravissimaCount >= 3 || total >= 15) {
      criticality = 'Crítico';
      riskBadgeClass = 'critico';
    } else if (gravissimaCount >= 1 || graveCount >= 3 || total >= 8) {
      criticality = 'Alto';
      riskBadgeClass = 'alto';
    } else if (total >= 3 || graveCount >= 1) {
      criticality = 'Moderado';
      riskBadgeClass = 'moderado';
    }

    // Status Summary
    let statusText = `Operação de fiscalização de campo concluída com ${total} ocorrência(s) autuada(s). Ponto focal de incidência em ${topLocation}.`;
    if (total === 0) {
      statusText = `Fiscalização ostensiva sem autuações registradas na data de referência. Padrão operacional normal.`;
    } else if (criticality === 'Crítico') {
      statusText = `Risco Operacional Elevado: Volume expressivo de infrações gravíssimas (${gravissimaCount}) e alta concentração em ${topLocation}.`;
    } else if (criticality === 'Alto') {
      statusText = `Intensa atividade fiscalizatória com incidência de infrações graves. Ações de patrulhamento direcionadas a ${topLocation}.`;
    }

    // Generate Location Table Rows
    const tableRows = sortedLocations.length > 0 
      ? sortedLocations.slice(0, 6).map(loc => {
          let badgeClass = 'baixo';
          if (loc.locRisk === 'Crítico') badgeClass = 'critico';
          else if (loc.locRisk === 'Alto') badgeClass = 'alto';
          else if (loc.locRisk === 'Moderado') badgeClass = 'moderado';

          return `
            <tr>
              <td><strong>${loc.locName}</strong></td>
              <td>${loc.predominantType}</td>
              <td style="text-align: center;"><strong>${loc.count}</strong></td>
              <td style="text-align: center;"><span class="badge-risk ${badgeClass}">${loc.locRisk}</span></td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Nenhuma infração registrada no período de referência.</td></tr>`;

    // Generate Infractions List
    const infractionListHtml = sortedInfractions.length > 0
      ? sortedInfractions.slice(0, 5).map(inf => {
          let descContext = `Infração de natureza ${inf.nature}, registrada em conformidade com as diretrizes do Código de Trânsito.`;
          if (inf.nature === 'Gravíssima') {
            descContext = `Infração de gravidade máxima (${inf.nature}), oferecendo risco iminente à segurança viária e de pedestres.`;
          } else if (inf.nature === 'Grave') {
            descContext = `Infração de alto impacto (${inf.nature}), requerendo intervenção ostensiva imediata no local.`;
          }
          return `
            <div class="infraction-item">
              <div class="title">
                <span>${inf.type}</span>
                <span class="badge-risk ${inf.nature.toLowerCase().replace('íssima', 'ssima')}">${inf.count} ocorrência(s)</span>
              </div>
              <div class="description">${descContext}</div>
            </div>`;
        }).join('')
      : `<div class="infraction-item"><div class="title">Sem infrações registradas</div><div class="description">Nenhuma ocorrência autuada no período.</div></div>`;

    // Actionable Recommendations
    const recommendations = total === 0 ? [
      `Manter a rotina de patrulhamento preventivo e fiscalização ostensiva nos pontos de maior fluxo da jurisdição.`,
      `Realizar ações educativas com condutores e pedestres para preservar os baixos índices de infração.`
    ] : [
      `Reforçar o efetivo de fiscalização nos pontos de maior incidência identificados (especialmente em <strong>${topLocation}</strong>).`,
      `Intensificar abordagens focadas no combate à infração principal do período (<strong>${topInfraction}</strong>).`,
      `Alocar equipes móveis em horários de pico para coibir infrações recorrentes e aumentar a segurança da comunidade.`,
      `Disponibilizar relatórios diários de acompanhamento para orientar o planejamento estratégico das próximas rotas.`
    ];

    const recsHtml = recommendations.map(rec => `<li>${rec}</li>`).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Diário de Infrações e Ocorrências - ${dateFormatted}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      line-height: 1.5;
      padding: 32px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      padding: 40px;
    }

    /* Header */
    .header {
      border-bottom: 3px solid #f59e0b;
      padding-bottom: 24px;
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-title h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }

    .header-title p {
      font-size: 13px;
      color: #475569;
      font-weight: 500;
    }

    .header-meta {
      text-align: right;
    }

    .header-meta .date-badge {
      display: inline-block;
      background-color: #0f172a;
      color: #fbbf24;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #334155;
      margin-bottom: 8px;
    }

    .status-box {
      margin-top: 16px;
      background-color: #f1f5f9;
      border-left: 4px solid #f59e0b;
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      color: #1e293b;
      font-weight: 600;
    }

    /* Metric Cards */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }

    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: left;
    }

    .metric-card .label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .metric-card .value {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .metric-card .subtext {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }

    /* Risk Badges */
    .badge-risk {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .badge-risk.baixo { background: #dcfce7; color: #166534; }
    .badge-risk.moderado { background: #fef9c3; color: #854d0e; }
    .badge-risk.alto { background: #ffedd5; color: #9a3412; }
    .badge-risk.critico, .badge-risk.gravissima { background: #fee2e2; color: #991b1b; }

    /* Section Titles */
    .section-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 16px;
      margin-top: 32px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Table Styles */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }

    th {
      background-color: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px 14px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }

    tr:nth-child(even) {
      background-color: #f8fafc;
    }

    /* List Breakdown */
    .infraction-list {
      margin-bottom: 24px;
    }

    .infraction-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #f59e0b;
      border-radius: 6px;
      padding: 14px 18px;
      margin-bottom: 10px;
    }

    .infraction-item .title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .infraction-item .description {
      font-size: 12.5px;
      color: #475569;
      margin-top: 4px;
    }

    /* Recommendations */
    .recommendations-list {
      list-style-type: none;
      counter-reset: rec-counter;
      margin-bottom: 24px;
    }

    .recommendations-list li {
      counter-increment: rec-counter;
      position: relative;
      padding-left: 36px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
    }

    .recommendations-list li::before {
      content: counter(rec-counter);
      position: absolute;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;
      background-color: #0f172a;
      color: #f59e0b;
      font-weight: 800;
      font-size: 11px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Footer */
    .footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
    }

    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .report-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

  <div class="report-container">
    <!-- 1. Exec Header -->
    <div class="header">
      <div class="header-title">
        <h1>📊 Relatório Diário de Infrações e Ocorrências</h1>
        <p>Sistema Integrado de Gestão e Inteligência de Trânsito</p>
      </div>
      <div class="header-meta">
        <div class="date-badge">Data: ${dateFormatted}</div>
      </div>
    </div>

    <!-- Status Geral -->
    <div class="status-box">
      <strong>Status Geral Operacional:</strong> ${statusText}
    </div>

    <!-- 2. Metric Cards -->
    <h2 class="section-title">1. Resumo Executivo</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">Total Ocorrências</div>
        <div class="value">${total}</div>
        <div class="subtext">Autuações no período</div>
      </div>

      <div class="metric-card">
        <div class="label">Área Crítica</div>
        <div class="value" title="${topLocation}">${topLocation}</div>
        <div class="subtext">Maior volume de campo</div>
      </div>

      <div class="metric-card">
        <div class="label">Infração Principal</div>
        <div class="value" title="${topInfraction}">${topInfraction}</div>
        <div class="subtext">Tipo predominante</div>
      </div>

      <div class="metric-card">
        <div class="label">Nível de Risco</div>
        <div style="margin-top: 4px;">
          <span class="badge-risk ${riskBadgeClass}">${criticality}</span>
        </div>
        <div class="subtext">Avaliação de impacto</div>
      </div>
    </div>

    <!-- 3. Mapeamento de Locais Críticos -->
    <h2 class="section-title">2. Mapeamento de Locais Críticos</h2>
    <table>
      <thead>
        <tr>
          <th>Ponto de Fiscalização / Local</th>
          <th>Tipo Predominante</th>
          <th style="text-align: center;">Volume</th>
          <th style="text-align: center;">Criticidade</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- 4. Detalhamento das Infrações -->
    <h2 class="section-title">3. Detalhamento das Infrações</h2>
    <div class="infraction-list">
      ${infractionListHtml}
    </div>

    <!-- 5. Recomendações Práticas para a Gestão -->
    <h2 class="section-title">4. Recomendações Estratégicas para a Gestão</h2>
    <ol class="recommendations-list">
      ${recsHtml}
    </ol>

    <!-- Footer -->
    <div class="footer">
      <span>Relatório Automático de Operação de Trânsito</span>
      <span>Gerado via Inteligência de Dados em ${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
  </div>

</body>
</html>`;
  }, [tickets, selectedDate]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatedHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                Relatório Diário
              </h2>
              <p className="text-xs text-slate-400 font-medium">Visualização e impressão do relatório diário estruturado para PDF</p>
            </div>
          </div>

          <button
            id="btn-close-exec-modal"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Controls Toolbar */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Calendar size={14} className="text-amber-400" />
            <label className="text-slate-400 font-bold uppercase tracking-wider text-xxs">Data de Referência:</label>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none"
            />
          </div>

          {/* Action Button: Imprimir / Salvar PDF */}
          <div className="flex items-center gap-2">
            <button
              id="btn-print-report"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Printer size={16} />
              <span>Imprimir / Salvar PDF</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden bg-slate-950 p-4">
          <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 bg-white shadow-inner">
            <iframe 
              srcDoc={generatedHtml} 
              className="w-full h-[620px] border-none"
              title="Relatório Diário Preview"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-amber-400" />
            <span>Formato estruturado para salvamento rápido em PDF.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
