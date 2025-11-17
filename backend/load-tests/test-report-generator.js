const fs = require('fs');
const path = require('path');
const TestResultCollector = require('./test-result-collector');

/**
 * Test Report Generator
 * Generates HTML reports with charts and comparisons
 */

class TestReportGenerator {
  constructor() {
    this.collector = new TestResultCollector();
    this.reportsDir = path.join(__dirname, 'results', 'reports');
    this.ensureReportsDir();
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive HTML report
   */
  generateReport(testResults, comparisonData = null) {
    const reportHtml = this.buildHtmlReport(testResults, comparisonData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `report-${testResults.test_type}-${timestamp}.html`;
    const filePath = path.join(this.reportsDir, fileName);
    
    fs.writeFileSync(filePath, reportHtml);
    console.log(`✓ Report generated: ${filePath}`);
    
    return filePath;
  }

  /**
   * Generate comparison report
   */
  generateComparisonReport(comparison) {
    const reportHtml = this.buildComparisonHtmlReport(comparison);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `comparison-report-${timestamp}.html`;
    const filePath = path.join(this.reportsDir, fileName);
    
    fs.writeFileSync(filePath, reportHtml);
    console.log(`✓ Comparison report generated: ${filePath}`);
    
    return filePath;
  }

  /**
   * Generate pattern impact report
   */
  generatePatternImpactReport(baselineResults, patternResults) {
    const comparison = this.collector.compareResults(baselineResults, patternResults);
    const reportHtml = this.buildPatternImpactHtmlReport(baselineResults, patternResults, comparison);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `pattern-impact-report-${timestamp}.html`;
    const filePath = path.join(this.reportsDir, fileName);
    
    fs.writeFileSync(filePath, reportHtml);
    console.log(`✓ Pattern impact report generated: ${filePath}`);
    
    return filePath;
  }

  /**
   * Build HTML report
   */
  buildHtmlReport(testResults, comparisonData) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Load Test Report - ${testResults.test_type}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        ${this.getCommonStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Load Test Report</h1>
            <div class="meta">
                <span><strong>Test Type:</strong> ${testResults.test_type}</span>
                <span><strong>Framework:</strong> ${testResults.framework}</span>
                <span><strong>Date:</strong> ${new Date(testResults.timestamp).toLocaleString()}</span>
                <span><strong>Duration:</strong> ${testResults.duration_seconds}s</span>
            </div>
        </header>

        <section class="summary">
            <h2>Executive Summary</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${testResults.summary.total_requests}</div>
                    <div class="metric-label">Total Requests</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${testResults.summary.requests_per_second}</div>
                    <div class="metric-label">Requests/sec</div>
                </div>
                <div class="metric-card ${this.getMetricClass(testResults.summary.error_rate_percent, 1)}">
                    <div class="metric-value">${testResults.summary.error_rate_percent}%</div>
                    <div class="metric-label">Error Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${testResults.summary.avg_response_time_ms}ms</div>
                    <div class="metric-label">Avg Response Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${testResults.summary.p95_response_time_ms}ms</div>
                    <div class="metric-label">P95 Response Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${testResults.summary.p99_response_time_ms}ms</div>
                    <div class="metric-label">P99 Response Time</div>
                </div>
            </div>
        </section>

        <section class="charts">
            <h2>Performance Metrics</h2>
            <div class="chart-container">
                <canvas id="responseTimeChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="requestsChart"></canvas>
            </div>
        </section>

        ${testResults.custom_metrics && Object.keys(testResults.custom_metrics).length > 0 ? `
        <section class="custom-metrics">
            <h2>Pattern-Specific Metrics</h2>
            <div class="metrics-grid">
                ${this.renderCustomMetrics(testResults.custom_metrics)}
            </div>
        </section>
        ` : ''}

        ${comparisonData ? this.renderComparisonSection(comparisonData) : ''}

        <section class="thresholds">
            <h2>Thresholds</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Threshold</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.renderThresholds(testResults.thresholds)}
                </tbody>
            </table>
        </section>

        <footer>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </footer>
    </div>

    <script>
        ${this.getChartScripts(testResults)}
    </script>
</body>
</html>
    `;
  }

  /**
   * Build comparison HTML report
   */
  buildComparisonHtmlReport(comparison) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Comparison Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        ${this.getCommonStyles()}
        .improvement { background: #d4edda; border-left: 4px solid #28a745; }
        .degradation { background: #f8d7da; border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Test Comparison Report</h1>
            <div class="meta">
                <span><strong>Test 1:</strong> ${comparison.test1.type} (${new Date(comparison.test1.timestamp).toLocaleString()})</span>
                <span><strong>Test 2:</strong> ${comparison.test2.type} (${new Date(comparison.test2.timestamp).toLocaleString()})</span>
            </div>
        </header>

        <section class="summary">
            <h2>Comparison Summary</h2>
            ${this.renderComparisonMetrics(comparison.summary)}
        </section>

        ${Object.keys(comparison.improvements).length > 0 ? `
        <section class="improvements">
            <h2>✓ Improvements</h2>
            ${this.renderImprovements(comparison.improvements)}
        </section>
        ` : ''}

        ${Object.keys(comparison.degradations).length > 0 ? `
        <section class="degradations">
            <h2>⚠ Degradations</h2>
            ${this.renderDegradations(comparison.degradations)}
        </section>
        ` : ''}

        <section class="charts">
            <h2>Visual Comparison</h2>
            <div class="chart-container">
                <canvas id="comparisonChart"></canvas>
            </div>
        </section>

        <footer>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </footer>
    </div>

    <script>
        ${this.getComparisonChartScripts(comparison)}
    </script>
</body>
</html>
    `;
  }

  /**
   * Build pattern impact HTML report
   */
  buildPatternImpactHtmlReport(baseline, pattern, comparison) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pattern Impact Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        ${this.getCommonStyles()}
        .pattern-highlight { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    </style>
</head>
<body>
    <div class="container">
        <header class="pattern-highlight">
            <h1>Design Pattern Impact Analysis</h1>
            <p>Measuring the performance impact of design patterns on system behavior</p>
        </header>

        <section class="comparison">
            <h2>Before vs After Comparison</h2>
            <div class="comparison-grid">
                <div class="before">
                    <h3>Before (Baseline)</h3>
                    <p><strong>Type:</strong> ${baseline.test_type}</p>
                    <p><strong>Avg Response:</strong> ${baseline.summary.avg_response_time_ms}ms</p>
                    <p><strong>Error Rate:</strong> ${baseline.summary.error_rate_percent}%</p>
                    <p><strong>Throughput:</strong> ${baseline.summary.requests_per_second} req/s</p>
                </div>
                <div class="after">
                    <h3>After (With Patterns)</h3>
                    <p><strong>Type:</strong> ${pattern.test_type}</p>
                    <p><strong>Avg Response:</strong> ${pattern.summary.avg_response_time_ms}ms</p>
                    <p><strong>Error Rate:</strong> ${pattern.summary.error_rate_percent}%</p>
                    <p><strong>Throughput:</strong> ${pattern.summary.requests_per_second} req/s</p>
                </div>
            </div>
        </section>

        <section class="impact">
            <h2>Pattern Impact Metrics</h2>
            ${this.renderPatternImpact(comparison)}
        </section>

        <section class="charts">
            <h2>Performance Visualization</h2>
            <div class="chart-container">
                <canvas id="impactChart"></canvas>
            </div>
        </section>

        <section class="recommendations">
            <h2>Recommendations</h2>
            ${this.generateRecommendations(comparison)}
        </section>

        <footer>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </footer>
    </div>

    <script>
        ${this.getPatternImpactChartScripts(baseline, pattern, comparison)}
    </script>
</body>
</html>
    `;
  }

  // Helper methods
  getCommonStyles() {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: #f5f7fa; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 8px; margin-bottom: 30px; }
        header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .meta { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px; }
        .meta span { background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 4px; }
        section { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h2 { color: #333; margin-bottom: 20px; font-size: 1.8rem; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #e9ecef; }
        .metric-card.good { border-color: #28a745; background: #d4edda; }
        .metric-card.warning { border-color: #ffc107; background: #fff3cd; }
        .metric-card.bad { border-color: #dc3545; background: #f8d7da; }
        .metric-value { font-size: 2rem; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 5px; font-size: 0.9rem; }
        .chart-container { margin: 20px 0; height: 400px; }
        table { width: 100%; border-collapse: collapse; }
        thead { background: #667eea; color: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        tbody tr:hover { background: #f8f9fa; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        footer { text-align: center; color: #666; margin-top: 40px; }
        .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .before, .after { padding: 20px; border-radius: 8px; }
        .before { background: #f8f9fa; border-left: 4px solid #6c757d; }
        .after { background: #d4edda; border-left: 4px solid #28a745; }
    `;
  }

  getMetricClass(value, threshold) {
    const numValue = parseFloat(value);
    if (numValue <= threshold) return 'good';
    if (numValue <= threshold * 2) return 'warning';
    return 'bad';
  }

  renderCustomMetrics(customMetrics) {
    return Object.entries(customMetrics).map(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      return `
        <div class="metric-card">
            <div class="metric-value">${displayValue}</div>
            <div class="metric-label">${key.replace(/_/g, ' ')}</div>
        </div>
      `;
    }).join('');
  }

  renderThresholds(thresholds) {
    if (!thresholds || Object.keys(thresholds).length === 0) {
      return '<tr><td colspan="3">No thresholds defined</td></tr>';
    }

    return Object.entries(thresholds).map(([metric, data]) => {
      const passed = data.ok || false;
      return `
        <tr>
            <td>${metric}</td>
            <td>${JSON.stringify(data.thresholds || [])}</td>
            <td class="${passed ? 'status-pass' : 'status-fail'}">${passed ? '✓ PASS' : '✗ FAIL'}</td>
        </tr>
      `;
    }).join('');
  }

  renderComparisonSection(comparisonData) {
    return `
      <section class="comparison">
          <h2>Comparison Analysis</h2>
          ${this.renderComparisonMetrics(comparisonData.summary)}
      </section>
    `;
  }

  renderComparisonMetrics(summary) {
    return `
      <table>
          <thead>
              <tr>
                  <th>Metric</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Change</th>
                  <th>Status</th>
              </tr>
          </thead>
          <tbody>
              ${Object.entries(summary).map(([metric, data]) => `
                  <tr>
                      <td>${metric}</td>
                      <td>${data.before}</td>
                      <td>${data.after}</td>
                      <td>${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} (${data.change_percent}%)</td>
                      <td class="${data.improved ? 'status-pass' : 'status-fail'}">
                          ${data.improved ? '✓ Improved' : '⚠ Degraded'}
                      </td>
                  </tr>
              `).join('')}
          </tbody>
      </table>
    `;
  }

  renderImprovements(improvements) {
    return `
      <div class="metrics-grid">
          ${Object.entries(improvements).map(([metric, data]) => `
              <div class="metric-card improvement">
                  <h4>${metric}</h4>
                  <p><strong>Before:</strong> ${data.before}</p>
                  <p><strong>After:</strong> ${data.after}</p>
                  <p><strong>Improvement:</strong> ${Math.abs(data.change_percent)}%</p>
              </div>
          `).join('')}
      </div>
    `;
  }

  renderDegradations(degradations) {
    return `
      <div class="metrics-grid">
          ${Object.entries(degradations).map(([metric, data]) => `
              <div class="metric-card degradation">
                  <h4>${metric}</h4>
                  <p><strong>Before:</strong> ${data.before}</p>
                  <p><strong>After:</strong> ${data.after}</p>
                  <p><strong>Degradation:</strong> ${Math.abs(data.change_percent)}%</p>
              </div>
          `).join('')}
      </div>
    `;
  }

  renderPatternImpact(comparison) {
    const metrics = comparison.summary;
    return `
      <div class="metrics-grid">
          ${Object.entries(metrics).map(([label, data]) => {
            const isImprovement = data.improved;
            return `
              <div class="metric-card ${isImprovement ? 'good' : 'bad'}">
                  <div class="metric-label">${label}</div>
                  <div class="metric-value">${data.change_percent}%</div>
                  <div class="metric-label">${isImprovement ? '↓ Improvement' : '↑ Impact'}</div>
              </div>
            `;
          }).join('')}
      </div>
    `;
  }

  generateRecommendations(comparison) {
    const recommendations = [];
    const summary = comparison.summary;

    Object.entries(summary).forEach(([metric, data]) => {
      if (metric.includes('Error Rate') && data.improved) {
        recommendations.push('✓ Error rate has significantly improved with pattern implementation.');
      }
      if (metric.includes('Response Time') && !data.improved && Math.abs(parseFloat(data.change_percent)) > 10) {
        recommendations.push('⚠ Response time has increased. Consider optimizing pattern implementation or adjusting worker concurrency.');
      }
      if (metric.includes('Throughput') && data.improved) {
        recommendations.push('✓ Throughput has improved, indicating better scalability with the patterns.');
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('No specific recommendations at this time. Continue monitoring.');
    }

    return `
      <ul>
          ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    `;
  }

  getChartScripts(testResults) {
    return `
      // Response Time Chart
      const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
      new Chart(responseTimeCtx, {
          type: 'bar',
          data: {
              labels: ['Average', 'P50', 'P95', 'P99'],
              datasets: [{
                  label: 'Response Time (ms)',
                  data: [
                      ${testResults.summary.avg_response_time_ms},
                      ${testResults.detailed_metrics.response_time.p50},
                      ${testResults.summary.p95_response_time_ms},
                      ${testResults.summary.p99_response_time_ms}
                  ],
                  backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#4facfe']
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  title: { display: true, text: 'Response Time Distribution' }
              }
          }
      });

      // Requests Chart
      const requestsCtx = document.getElementById('requestsChart').getContext('2d');
      new Chart(requestsCtx, {
          type: 'doughnut',
          data: {
              labels: ['Successful', 'Failed'],
              datasets: [{
                  data: [
                      ${testResults.summary.total_requests - (testResults.detailed_metrics.errors.count || 0)},
                      ${testResults.detailed_metrics.errors.count || 0}
                  ],
                  backgroundColor: ['#28a745', '#dc3545']
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  title: { display: true, text: 'Request Success Rate' }
              }
          }
      });
    `;
  }

  getComparisonChartScripts(comparison) {
    const labels = Object.keys(comparison.summary);
    const beforeData = labels.map(label => parseFloat(comparison.summary[label].before));
    const afterData = labels.map(label => parseFloat(comparison.summary[label].after));

    return `
      const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
      new Chart(comparisonCtx, {
          type: 'bar',
          data: {
              labels: ${JSON.stringify(labels)},
              datasets: [
                  {
                      label: 'Before',
                      data: ${JSON.stringify(beforeData)},
                      backgroundColor: '#6c757d'
                  },
                  {
                      label: 'After',
                      data: ${JSON.stringify(afterData)},
                      backgroundColor: '#28a745'
                  }
              ]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  title: { display: true, text: 'Before vs After Comparison' }
              }
          }
      });
    `;
  }

  getPatternImpactChartScripts(baseline, pattern, comparison) {
    const labels = Object.keys(comparison.summary);
    const changePercentData = labels.map(label => parseFloat(comparison.summary[label].change_percent));

    return `
      const impactCtx = document.getElementById('impactChart').getContext('2d');
      new Chart(impactCtx, {
          type: 'bar',
          data: {
              labels: ${JSON.stringify(labels)},
              datasets: [{
                  label: 'Change (%)',
                  data: ${JSON.stringify(changePercentData)},
                  backgroundColor: ${JSON.stringify(changePercentData.map(val => val < 0 ? '#28a745' : '#dc3545'))}
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  title: { display: true, text: 'Pattern Impact (% Change)' }
              },
              scales: {
                  y: {
                      beginAtZero: true
                  }
              }
          }
      });
    `;
  }
}

// CLI usage
if (require.main === module) {
  const generator = new TestReportGenerator();
  const collector = new TestResultCollector();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node test-report-generator.js report <test-id>');
    console.log('  node test-report-generator.js compare <test-id-1> <test-id-2>');
    console.log('  node test-report-generator.js pattern-impact <baseline-id> <pattern-id>');
    process.exit(0);
  }

  const command = args[0];
  const allResults = collector.loadAllProcessedResults();

  switch (command) {
    case 'report':
      if (args.length < 2) {
        console.error('Error: Provide test ID');
        process.exit(1);
      }

      const testResult = allResults.find(t => t.test_id === args[1]);
      if (!testResult) {
        console.error('Error: Test ID not found');
        process.exit(1);
      }

      generator.generateReport(testResult);
      break;

    case 'compare':
      if (args.length < 3) {
        console.error('Error: Provide two test IDs');
        process.exit(1);
      }

      const test1 = allResults.find(t => t.test_id === args[1]);
      const test2 = allResults.find(t => t.test_id === args[2]);

      if (!test1 || !test2) {
        console.error('Error: One or both test IDs not found');
        process.exit(1);
      }

      const comparison = collector.compareResults(test1, test2);
      generator.generateComparisonReport(comparison);
      break;

    case 'pattern-impact':
      if (args.length < 3) {
        console.error('Error: Provide baseline and pattern test IDs');
        process.exit(1);
      }

      const baseline = allResults.find(t => t.test_id === args[1]);
      const pattern = allResults.find(t => t.test_id === args[2]);

      if (!baseline || !pattern) {
        console.error('Error: One or both test IDs not found');
        process.exit(1);
      }

      generator.generatePatternImpactReport(baseline, pattern);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

module.exports = TestReportGenerator;
