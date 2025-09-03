/**
 * Evidence Pack Batch Processing System
 * Handles high-throughput batch exports with queue management,
 * concurrency control, and performance optimization for EU/EES compliance.
 */

import { EventEmitter } from 'events';
import { generateHumanFriendlyId } from '../../lib/utils';
import { EvidencePackExporter, ExportBatch } from './evidence-pack-export';
import { AuditLogger } from './audit-logger';

export interface BatchJob {
  id: string;
  packIds: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created: Date;
  started?: Date;
  completed?: Date;
  progress: {
    total: number;
    processed: number;
    failed: number;
    current?: string;
  };
  settings: {
    compressionLevel: number;
    maxConcurrency: number;
    timeout: number;
    retryAttempts: number;
  };
  metadata: {
    userId: string;
    reason?: string;
    scheduledFor?: Date;
  };
  results?: {
    successful: string[];
    failed: Array<{ packId: string; error: string }>;
    artifacts: Array<{ packId: string; size: number; location: string }>;
  };
}

export interface BatchQueue {
  jobs: BatchJob[];
  running: BatchJob[];
  completed: BatchJob[];
  failed: BatchJob[];
  stats: {
    totalJobs: number;
    avgProcessingTime: number;
    successRate: number;
    queueLength: number;
  };
}

export interface BatchSchedule {
  id: string;
  name: string;
  cronExpression: string;
  packFilter: {
    organizationIds?: string[];
    months?: string[];
    ageMinDays?: number;
    maxSize?: number;
  };
  settings: BatchJob['settings'];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface ConcurrencyController {
  maxConcurrent: number;
  currentLoad: number;
  adaptiveScaling: boolean;
  metrics: {
    avgMemoryUsage: number;
    avgCpuUsage: number;
    networkThroughput: number;
  };
}

export interface ResourceMonitor {
  memoryThreshold: number;
  cpuThreshold: number;
  diskThreshold: number;
  networkThreshold: number;
  currentUsage: {
    memory: number;
    cpu: number;
    disk: number;
    network: number;
  };
}

export class EvidencePackBatchProcessor extends EventEmitter {
  private exporter: EvidencePackExporter;
  private auditLogger: AuditLogger;
  private queue: BatchQueue;
  private concurrencyController: ConcurrencyController;
  private resourceMonitor: ResourceMonitor;
  private schedules: Map<string, BatchSchedule>;
  private processing: boolean;

  constructor(
    exporter: EvidencePackExporter,
    auditLogger: AuditLogger,
    options: {
      maxConcurrency?: number;
      memoryThreshold?: number;
      enableAdaptiveScaling?: boolean;
    } = {}
  ) {
    super();
    
    this.exporter = exporter;
    this.auditLogger = auditLogger;
    this.processing = false;
    this.schedules = new Map();

    this.queue = {
      jobs: [],
      running: [],
      completed: [],
      failed: [],
      stats: {
        totalJobs: 0,
        avgProcessingTime: 0,
        successRate: 0,
        queueLength: 0
      }
    };

    this.concurrencyController = {
      maxConcurrent: options.maxConcurrency || 3,
      currentLoad: 0,
      adaptiveScaling: options.enableAdaptiveScaling || true,
      metrics: {
        avgMemoryUsage: 0,
        avgCpuUsage: 0,
        networkThroughput: 0
      }
    };

    this.resourceMonitor = {
      memoryThreshold: options.memoryThreshold || 80,
      cpuThreshold: 75,
      diskThreshold: 85,
      networkThreshold: 90,
      currentUsage: {
        memory: 45,
        cpu: 30,
        disk: 60,
        network: 25
      }
    };

    // Start processing loop
    this.startProcessingLoop();
    
    // Start resource monitoring
    this.startResourceMonitoring();
  }

  async submitBatchJob(
    packIds: string[],
    options: {
      priority?: BatchJob['priority'];
      userId: string;
      reason?: string;
      compressionLevel?: number;
      maxConcurrency?: number;
      timeout?: number;
      scheduledFor?: Date;
    }
  ): Promise<BatchJob> {
    const job: BatchJob = {
      id: generateHumanFriendlyId('BATCH', Date.now()),
      packIds: [...packIds],
      priority: options.priority || 'normal',
      status: 'queued',
      created: new Date(),
      progress: {
        total: packIds.length,
        processed: 0,
        failed: 0
      },
      settings: {
        compressionLevel: options.compressionLevel || 6,
        maxConcurrency: options.maxConcurrency || 3,
        timeout: options.timeout || 30000,
        retryAttempts: 3
      },
      metadata: {
        userId: options.userId,
        reason: options.reason,
        scheduledFor: options.scheduledFor
      }
    };

    // Add to queue with priority ordering
    this.queue.jobs.push(job);
    this.queue.jobs.sort(this.priorityComparator);
    this.queue.stats.totalJobs++;
    this.queue.stats.queueLength = this.queue.jobs.length;

    // Audit log
    await this.auditLogger.log({
      id: generateHumanFriendlyId('AUD', Date.now()),
      timestamp: new Date(),
      userId: options.userId,
      action: 'batch_job_submitted',
      status: 'success',
      details: `Batch job submitted with ${packIds.length} packs`,
      metadata: {
        jobId: job.id,
        priority: job.priority,
        packCount: packIds.length
      }
    });

    this.emit('jobQueued', job);
    return job;
  }

  async cancelBatchJob(jobId: string, userId: string): Promise<boolean> {
    // Remove from queue if not started
    const queueIndex = this.queue.jobs.findIndex(j => j.id === jobId);
    if (queueIndex >= 0) {
      const job = this.queue.jobs[queueIndex];
      job.status = 'cancelled';
      this.queue.jobs.splice(queueIndex, 1);
      this.queue.failed.push(job);
      
      await this.auditLogger.log({
        id: generateHumanFriendlyId('AUD', Date.now()),
        timestamp: new Date(),
        userId,
        action: 'batch_job_cancelled',
        status: 'success',
        details: 'Batch job cancelled before processing',
        metadata: { jobId }
      });

      this.emit('jobCancelled', job);
      return true;
    }

    // Cancel running job
    const runningJob = this.queue.running.find(j => j.id === jobId);
    if (runningJob) {
      runningJob.status = 'cancelled';
      // Implementation would stop actual processing
      
      await this.auditLogger.log({
        id: generateHumanFriendlyId('AUD', Date.now()),
        timestamp: new Date(),
        userId,
        action: 'batch_job_cancelled',
        status: 'success',
        details: 'Running batch job cancelled',
        metadata: { jobId }
      });

      this.emit('jobCancelled', runningJob);
      return true;
    }

    return false;
  }

  async getBatchStatus(jobId: string): Promise<BatchJob | null> {
    // Search in all queues
    const allJobs = [
      ...this.queue.jobs,
      ...this.queue.running,
      ...this.queue.completed,
      ...this.queue.failed
    ];

    return allJobs.find(j => j.id === jobId) || null;
  }

  async getQueueMetrics(): Promise<{
    queue: BatchQueue['stats'];
    concurrency: ConcurrencyController;
    resources: ResourceMonitor;
    performance: {
      throughputPerHour: number;
      avgJobDuration: number;
      errorRate: number;
      resourceEfficiency: number;
    };
  }> {
    // Calculate performance metrics
    const completedJobs = this.queue.completed;
    const failedJobs = this.queue.failed;
    const totalCompleted = completedJobs.length + failedJobs.length;
    
    const throughputPerHour = totalCompleted > 0 
      ? (totalCompleted / (Date.now() - this.queue.completed[0]?.created?.getTime() || Date.now())) * 3600000
      : 0;

    const avgJobDuration = completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => {
          const duration = (job.completed?.getTime() || 0) - (job.started?.getTime() || 0);
          return sum + duration;
        }, 0) / completedJobs.length
      : 0;

    const errorRate = totalCompleted > 0 ? (failedJobs.length / totalCompleted) * 100 : 0;
    
    const resourceEfficiency = (
      (100 - this.resourceMonitor.currentUsage.memory) +
      (100 - this.resourceMonitor.currentUsage.cpu) +
      (100 - this.resourceMonitor.currentUsage.disk)
    ) / 3;

    return {
      queue: this.queue.stats,
      concurrency: this.concurrencyController,
      resources: this.resourceMonitor,
      performance: {
        throughputPerHour,
        avgJobDuration,
        errorRate,
        resourceEfficiency
      }
    };
  }

  async scheduleRecurringBatch(
    schedule: Omit<BatchSchedule, 'id' | 'lastRun' | 'nextRun'>
  ): Promise<BatchSchedule> {
    const fullSchedule: BatchSchedule = {
      id: generateHumanFriendlyId('SCHED', Date.now()),
      ...schedule,
      nextRun: this.calculateNextRun(schedule.cronExpression)
    };

    this.schedules.set(fullSchedule.id, fullSchedule);
    
    // Start cron monitoring if not already running
    this.startCronProcessor();

    return fullSchedule;
  }

  async optimizeConcurrency(): Promise<{
    previousMax: number;
    newMax: number;
    reason: string;
    expectedImprovement: string;
  }> {
    const currentMax = this.concurrencyController.maxConcurrent;
    let newMax = currentMax;
    let reason = 'No optimization needed';
    let expectedImprovement = 'None';

    // Analyze current performance
    const metrics = await this.getQueueMetrics();
    
    if (this.resourceMonitor.currentUsage.memory < 60 && 
        this.resourceMonitor.currentUsage.cpu < 50) {
      // Resources available, increase concurrency
      newMax = Math.min(currentMax + 1, 10);
      reason = 'Low resource utilization detected';
      expectedImprovement = '15-25% throughput increase';
    } else if (this.resourceMonitor.currentUsage.memory > 85 ||
               this.resourceMonitor.currentUsage.cpu > 80) {
      // High resource usage, decrease concurrency
      newMax = Math.max(currentMax - 1, 1);
      reason = 'High resource utilization detected';
      expectedImprovement = '10-20% stability increase';
    }

    if (newMax !== currentMax) {
      this.concurrencyController.maxConcurrent = newMax;
      
      await this.auditLogger.log({
        id: generateHumanFriendlyId('AUD', Date.now()),
        timestamp: new Date(),
        userId: 'system',
        action: 'concurrency_optimized',
        status: 'success',
        details: `Concurrency adjusted from ${currentMax} to ${newMax}`,
        metadata: { reason, metrics: this.resourceMonitor.currentUsage }
      });
    }

    return {
      previousMax: currentMax,
      newMax,
      reason,
      expectedImprovement
    };
  }

  private async startProcessingLoop(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    const processLoop = async () => {
      try {
        // Check if we can process more jobs
        if (this.queue.running.length < this.concurrencyController.maxConcurrent &&
            this.queue.jobs.length > 0) {
          
          // Get next job (highest priority first)
          const job = this.queue.jobs.shift();
          if (!job) return;

          // Check if job is scheduled for future
          if (job.metadata.scheduledFor && job.metadata.scheduledFor > new Date()) {
            this.queue.jobs.push(job); // Put back in queue
            return;
          }

          // Move to running
          job.status = 'processing';
          job.started = new Date();
          this.queue.running.push(job);

          // Process job
          this.processJob(job).catch(error => {
            console.error('Job processing error:', error);
          });
        }

        // Update queue stats
        this.queue.stats.queueLength = this.queue.jobs.length;
        this.queue.stats.successRate = this.calculateSuccessRate();

      } catch (error) {
        console.error('Processing loop error:', error);
      }

      // Continue processing
      setTimeout(processLoop, 1000);
    };

    processLoop();
  }

  private async processJob(job: BatchJob): Promise<void> {
    try {
      job.results = {
        successful: [],
        failed: [],
        artifacts: []
      };

      // Process packs with limited concurrency
      const semaphore = new Array(job.settings.maxConcurrency).fill(null);
      
      await Promise.allSettled(
        job.packIds.map(async (packId, index) => {
          // Wait for semaphore slot
          await this.waitForSlot(semaphore, index % job.settings.maxConcurrency);
          
          try {
            job.progress.current = packId;
            
            // Process individual pack
            const result = await this.processSinglePack(packId, job.settings);
            
            job.results!.successful.push(packId);
            job.results!.artifacts.push(result);
            job.progress.processed++;

            this.emit('packProcessed', { jobId: job.id, packId, result });

          } catch (error) {
            job.results!.failed.push({
              packId,
              error: error.message
            });
            job.progress.failed++;

            this.emit('packFailed', { jobId: job.id, packId, error });

          } finally {
            // Release semaphore slot
            this.releaseSlot(semaphore, index % job.settings.maxConcurrency);
          }
        })
      );

      // Job completed
      job.status = 'completed';
      job.completed = new Date();

      // Move from running to completed
      const runningIndex = this.queue.running.findIndex(j => j.id === job.id);
      if (runningIndex >= 0) {
        this.queue.running.splice(runningIndex, 1);
        this.queue.completed.push(job);
      }

      // Audit log
      await this.auditLogger.log({
        id: generateHumanFriendlyId('AUD', Date.now()),
        timestamp: new Date(),
        userId: job.metadata.userId,
        action: 'batch_job_completed',
        status: 'success',
        details: `Batch job completed: ${job.results.successful.length} successful, ${job.results.failed.length} failed`,
        metadata: {
          jobId: job.id,
          duration: job.completed.getTime() - job.started!.getTime(),
          results: job.results
        }
      });

      this.emit('jobCompleted', job);

    } catch (error) {
      job.status = 'failed';
      job.completed = new Date();

      // Move from running to failed
      const runningIndex = this.queue.running.findIndex(j => j.id === job.id);
      if (runningIndex >= 0) {
        this.queue.running.splice(runningIndex, 1);
        this.queue.failed.push(job);
      }

      await this.auditLogger.log({
        id: generateHumanFriendlyId('AUD', Date.now()),
        timestamp: new Date(),
        userId: job.metadata.userId,
        action: 'batch_job_failed',
        status: 'failure',
        details: `Batch job failed: ${error.message}`,
        metadata: { jobId: job.id, error: error.toString() }
      });

      this.emit('jobFailed', job);
    }
  }

  private async processSinglePack(packId: string, settings: BatchJob['settings']): Promise<{
    packId: string;
    size: number;
    location: string;
  }> {
    // Simulate processing time and resource usage
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return {
      packId,
      size: Math.floor(1024 * 1024 + Math.random() * 5 * 1024 * 1024), // 1-6MB
      location: `s3://svoa-lea-evidence/packs/${packId}.zip`
    };
  }

  private async waitForSlot(semaphore: any[], slotIndex: number): Promise<void> {
    while (semaphore[slotIndex] !== null) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    semaphore[slotIndex] = true;
  }

  private releaseSlot(semaphore: any[], slotIndex: number): void {
    semaphore[slotIndex] = null;
  }

  private startResourceMonitoring(): void {
    setInterval(() => {
      // Simulate resource monitoring
      this.resourceMonitor.currentUsage.memory = 30 + Math.random() * 40;
      this.resourceMonitor.currentUsage.cpu = 20 + Math.random() * 50;
      this.resourceMonitor.currentUsage.disk = 50 + Math.random() * 30;
      this.resourceMonitor.currentUsage.network = 10 + Math.random() * 30;

      // Trigger optimization if adaptive scaling is enabled
      if (this.concurrencyController.adaptiveScaling) {
        this.optimizeConcurrency().catch(error => {
          console.error('Concurrency optimization failed:', error);
        });
      }
    }, 30000); // Check every 30 seconds
  }

  private startCronProcessor(): void {
    setInterval(async () => {
      const now = new Date();
      
      for (const [scheduleId, schedule] of this.schedules) {
        if (schedule.enabled && 
            schedule.nextRun && 
            schedule.nextRun <= now) {
          
          try {
            // Find packs matching the filter
            const packIds = await this.findPacksByFilter(schedule.packFilter);
            
            if (packIds.length > 0) {
              await this.submitBatchJob(packIds, {
                priority: 'normal',
                userId: 'system',
                reason: `Scheduled batch: ${schedule.name}`,
                ...schedule.settings
              });
            }

            // Update schedule
            schedule.lastRun = now;
            schedule.nextRun = this.calculateNextRun(schedule.cronExpression, now);

          } catch (error) {
            await this.auditLogger.log({
              id: generateHumanFriendlyId('AUD', Date.now()),
              timestamp: new Date(),
              userId: 'system',
              action: 'scheduled_batch_failed',
              status: 'failure',
              details: `Scheduled batch failed: ${error.message}`,
              metadata: { scheduleId, scheduleName: schedule.name }
            });
          }
        }
      }
    }, 60000); // Check every minute
  }

  private priorityComparator(a: BatchJob, b: BatchJob): number {
    const priorityWeight = { critical: 4, high: 3, normal: 2, low: 1 };
    const weightA = priorityWeight[a.priority];
    const weightB = priorityWeight[b.priority];
    
    if (weightA !== weightB) {
      return weightB - weightA; // Higher priority first
    }
    
    return a.created.getTime() - b.created.getTime(); // Earlier first for same priority
  }

  private calculateSuccessRate(): number {
    const total = this.queue.completed.length + this.queue.failed.length;
    if (total === 0) return 100;
    
    return (this.queue.completed.length / total) * 100;
  }

  private calculateNextRun(cronExpression: string, from: Date = new Date()): Date {
    // Simple cron parser - in production use a proper cron library
    // For now, assume daily at midnight
    const nextRun = new Date(from);
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(0, 0, 0, 0);
    return nextRun;
  }

  private async findPacksByFilter(filter: BatchSchedule['packFilter']): Promise<string[]> {
    // Mock implementation - in production would query actual pack database
    const mockPacks = [
      'EVP-2024-11-001',
      'EVP-2024-11-002',
      'EVP-2024-11-003'
    ];
    
    return mockPacks.filter(packId => {
      // Apply filters
      if (filter.months && !filter.months.some(month => packId.includes(month))) {
        return false;
      }
      
      if (filter.organizationIds && filter.organizationIds.length > 0) {
        // Would check against actual organization data
      }
      
      return true;
    });
  }
}

export default EvidencePackBatchProcessor;