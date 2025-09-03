/**
 * Evidence Pack Batch Operations Tests
 * Testing batch processing, performance, and scalability
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  BatchExporter,
  BatchQueue,
  BatchScheduler,
  PerformanceMonitor,
  ResourcePoolManager,
  ConcurrencyController,
  BatchReport
} from '../evidence-pack-batch';
import { EventEmitter } from 'events';

describe('Evidence Pack Batch Processing', () => {
  let batchExporter: BatchExporter;
  let batchQueue: BatchQueue;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    batchQueue = new BatchQueue({
      maxConcurrent: 10,
      maxQueueSize: 1000
    });

    performanceMonitor = new PerformanceMonitor();

    batchExporter = new BatchExporter({
      queue: batchQueue,
      monitor: performanceMonitor,
      region: 'eu-north-1'
    });
  });

  describe('Batch Queue Management', () => {
    it('should queue and process multiple export requests', async () => {
      const requests = Array.from({ length: 50 }, (_, i) => ({
        insightId: `INS-2024-11-${String(i).padStart(3, '0')}`,
        priority: Math.floor(Math.random() * 3),
        requestedBy: `user${i}@example.se`
      }));

      const queueResults = await batchExporter.queueBatch(requests);

      expect(queueResults.queued).toBe(50);
      expect(queueResults.rejected).toBe(0);
      expect(queueResults.queueIds).toHaveLength(50);
      expect(queueResults.estimatedProcessingTime).toBeGreaterThan(0);
    });

    it('should respect priority ordering in queue processing', async () => {
      const highPriorityJob = { id: 'high', priority: 0 };
      const mediumPriorityJob = { id: 'medium', priority: 1 };
      const lowPriorityJob = { id: 'low', priority: 2 };

      await batchQueue.add(lowPriorityJob);
      await batchQueue.add(highPriorityJob);
      await batchQueue.add(mediumPriorityJob);

      const processingOrder = [];
      batchQueue.on('process', (job) => processingOrder.push(job.id));

      await batchQueue.processAll();

      expect(processingOrder[0]).toBe('high');
      expect(processingOrder[1]).toBe('medium');
      expect(processingOrder[2]).toBe('low');
    });

    it('should handle queue overflow gracefully', async () => {
      const maxSize = 100;
      const overflowQueue = new BatchQueue({ maxQueueSize: maxSize });

      const requests = Array.from({ length: 150 }, (_, i) => ({
        insightId: `INS-2024-11-${String(i).padStart(3, '0')}`
      }));

      const result = await overflowQueue.addBatch(requests);

      expect(result.accepted).toBe(maxSize);
      expect(result.rejected).toBe(50);
      expect(result.rejectionReason).toBe('Queue capacity exceeded');
    });

    it('should implement backpressure when queue is full', async () => {
      const queue = new BatchQueue({
        maxQueueSize: 10,
        backpressureThreshold: 0.8 // 80%
      });

      await queue.addBatch(Array(8).fill({ id: 'test' }));
      
      expect(queue.isBackpressureActive()).toBe(true);
      expect(queue.getBackpressureLevel()).toBe(0.8);
      
      // Should slow down processing
      const slowAddResult = await queue.add({ id: 'slow' });
      expect(slowAddResult.throttled).toBe(true);
    });
  });

  describe('Concurrency Control', () => {
    it('should limit concurrent export operations', async () => {
      const controller = new ConcurrencyController({
        maxConcurrent: 5,
        monitorResources: true
      });

      const operations = Array.from({ length: 20 }, (_, i) => 
        controller.execute(() => new Promise(resolve => 
          setTimeout(() => resolve(i), 100)
        ))
      );

      const concurrentCount = controller.getCurrentConcurrency();
      expect(concurrentCount).toBeLessThanOrEqual(5);

      const results = await Promise.all(operations);
      expect(results).toHaveLength(20);
    });

    it('should dynamically adjust concurrency based on system load', async () => {
      const adaptiveController = new ConcurrencyController({
        maxConcurrent: 10,
        adaptiveConcurrency: true,
        targetCPU: 70, // Target 70% CPU usage
        targetMemory: 80 // Target 80% memory usage
      });

      // Simulate high system load
      adaptiveController.updateSystemMetrics({
        cpu: 85,
        memory: 75
      });

      expect(adaptiveController.getAdjustedConcurrency()).toBeLessThan(10);

      // Simulate low system load
      adaptiveController.updateSystemMetrics({
        cpu: 30,
        memory: 40
      });

      expect(adaptiveController.getAdjustedConcurrency()).toBe(10);
    });

    it('should implement rate limiting for batch operations', async () => {
      const rateLimiter = batchExporter.createRateLimiter({
        maxRequestsPerSecond: 10,
        burstSize: 15
      });

      const startTime = Date.now();
      const requests = Array(25).fill({ id: 'test' });
      
      await rateLimiter.processBatch(requests);
      
      const elapsed = Date.now() - startTime;
      
      // Should take at least 1.5 seconds (15 burst + 10 more at 10/sec)
      expect(elapsed).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track individual export performance metrics', async () => {
      const metrics = await performanceMonitor.measureExport(async () => {
        // Simulate export operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { packId: 'EP-2024-11-001', size: 1024000 };
      });

      expect(metrics.duration).toBeGreaterThanOrEqual(100);
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.memoryUsed).toBeGreaterThan(0);
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate batch performance statistics', async () => {
      const batchMetrics = [];
      
      for (let i = 0; i < 10; i++) {
        const metric = await performanceMonitor.measureExport(async () => {
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
          return { packId: `EP-2024-11-${i}`, size: 1024000 };
        });
        batchMetrics.push(metric);
      }

      const aggregated = performanceMonitor.aggregateMetrics(batchMetrics);

      expect(aggregated.totalExports).toBe(10);
      expect(aggregated.avgDuration).toBeGreaterThan(50);
      expect(aggregated.minDuration).toBeGreaterThanOrEqual(50);
      expect(aggregated.maxDuration).toBeLessThanOrEqual(150);
      expect(aggregated.totalDataProcessed).toBe(10240000);
      expect(aggregated.avgThroughput).toBeGreaterThan(0);
    });

    it('should detect performance degradation', async () => {
      performanceMonitor.setBaseline({
        avgDuration: 100,
        avgThroughput: 10240000
      });

      // Simulate degraded performance
      const degradedMetric = {
        duration: 500, // 5x slower
        throughput: 2048000 // 80% slower
      };

      const alert = performanceMonitor.checkDegradation(degradedMetric);

      expect(alert.degraded).toBe(true);
      expect(alert.durationDegradation).toBe(400); // 400% slower
      expect(alert.throughputDegradation).toBe(80); // 80% reduction
      expect(alert.severity).toBe('high');
    });
  });

  describe('Resource Pool Management', () => {
    it('should manage connection pool efficiently', async () => {
      const poolManager = new ResourcePoolManager({
        minConnections: 5,
        maxConnections: 20,
        connectionTimeout: 5000,
        idleTimeout: 30000
      });

      await poolManager.initialize();

      expect(poolManager.getActiveConnections()).toBeGreaterThanOrEqual(5);
      expect(poolManager.getIdleConnections()).toBeLessThanOrEqual(20);

      // Simulate high load
      const connections = await Promise.all(
        Array(15).fill(null).map(() => poolManager.acquire())
      );

      expect(poolManager.getActiveConnections()).toBe(15);

      // Release connections
      await Promise.all(connections.map(conn => poolManager.release(conn)));

      expect(poolManager.getIdleConnections()).toBeGreaterThan(0);
    });

    it('should handle connection pool exhaustion', async () => {
      const smallPool = new ResourcePoolManager({
        maxConnections: 3,
        connectionTimeout: 1000,
        queueRequests: true
      });

      await smallPool.initialize();

      // Acquire all connections
      const connections = await Promise.all(
        Array(3).fill(null).map(() => smallPool.acquire())
      );

      // Try to acquire one more (should wait or fail)
      const waitingPromise = smallPool.acquire();
      
      // Release one connection after delay
      setTimeout(() => smallPool.release(connections[0]), 500);

      const acquired = await waitingPromise;
      expect(acquired).toBeDefined();
    });

    it('should implement connection health checks', async () => {
      const poolManager = new ResourcePoolManager({
        maxConnections: 10,
        healthCheckInterval: 5000,
        maxRetries: 3
      });

      await poolManager.initialize();

      const healthStatus = await poolManager.checkHealth();

      expect(healthStatus.healthy).toBeGreaterThan(0);
      expect(healthStatus.unhealthy).toBe(0);
      expect(healthStatus.recycled).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Scheduling', () => {
    it('should schedule batch exports at specific times', async () => {
      const scheduler = new BatchScheduler({
        timezone: 'Europe/Stockholm'
      });

      const schedule = scheduler.createSchedule({
        type: 'daily',
        time: '02:00', // 2 AM Stockholm time
        insightPattern: 'INS-2024-11-*',
        enabled: true
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.nextRun).toBeInstanceOf(Date);
      expect(schedule.nextRun.getHours()).toBe(2);
    });

    it('should support recurring batch schedules', async () => {
      const scheduler = new BatchScheduler();

      const weeklySchedule = scheduler.createSchedule({
        type: 'weekly',
        dayOfWeek: 'monday',
        time: '00:00',
        repeatCount: 4
      });

      const monthlySchedule = scheduler.createSchedule({
        type: 'monthly',
        dayOfMonth: 1,
        time: '00:00'
      });

      expect(weeklySchedule.frequency).toBe('weekly');
      expect(monthlySchedule.frequency).toBe('monthly');
      
      const nextRuns = scheduler.getUpcomingRuns(10);
      expect(nextRuns).toHaveLength(10);
    });

    it('should handle schedule conflicts and overlaps', async () => {
      const scheduler = new BatchScheduler({
        preventOverlap: true
      });

      const schedule1 = scheduler.createSchedule({
        id: 'schedule1',
        type: 'hourly',
        estimatedDuration: 45 // minutes
      });

      const schedule2 = scheduler.createSchedule({
        id: 'schedule2',
        type: 'hourly',
        offset: 30 // 30 minutes offset
      });

      const conflicts = scheduler.detectConflicts();
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].schedules).toContain('schedule1');
      expect(conflicts[0].schedules).toContain('schedule2');
      expect(conflicts[0].overlapMinutes).toBe(15);
    });
  });

  describe('Batch Reporting', () => {
    it('should generate comprehensive batch export reports', async () => {
      const batchResult = {
        batchId: 'BATCH-2024-11-001',
        startTime: new Date('2024-11-15T00:00:00Z'),
        endTime: new Date('2024-11-15T00:30:00Z'),
        totalRequests: 100,
        successful: 95,
        failed: 5,
        exports: Array(100).fill(null).map((_, i) => ({
          insightId: `INS-2024-11-${String(i).padStart(3, '0')}`,
          status: i < 95 ? 'success' : 'failed',
          duration: 15000 + Math.random() * 5000,
          size: 1024000 + Math.random() * 512000
        }))
      };

      const report = BatchReport.generate(batchResult);

      expect(report.summary.successRate).toBe(95);
      expect(report.summary.totalDuration).toBe(30); // minutes
      expect(report.summary.avgExportTime).toBeGreaterThan(15);
      expect(report.summary.totalDataSize).toBeGreaterThan(100 * 1024000);
      
      expect(report.failures).toHaveLength(5);
      expect(report.performance.slowestExports).toHaveLength(10);
      expect(report.performance.fastestExports).toHaveLength(10);
    });

    it('should track batch export history and trends', async () => {
      const history = await batchExporter.getBatchHistory({
        from: new Date('2024-11-01'),
        to: new Date('2024-11-30')
      });

      expect(history.batches).toBeInstanceOf(Array);
      expect(history.totalBatches).toBeGreaterThanOrEqual(0);
      expect(history.totalExports).toBeGreaterThanOrEqual(0);
      expect(history.avgSuccessRate).toBeLessThanOrEqual(100);
      
      expect(history.trends.exportsPerDay).toBeInstanceOf(Object);
      expect(history.trends.peakHour).toBeDefined();
      expect(history.trends.avgBatchSize).toBeGreaterThanOrEqual(0);
    });

    it('should generate alerts for batch failures', async () => {
      const alertManager = batchExporter.getAlertManager();

      const failedBatch = {
        batchId: 'BATCH-2024-11-002',
        successRate: 60, // Below threshold
        failures: 40,
        errors: [
          { type: 'NETWORK_ERROR', count: 25 },
          { type: 'VALIDATION_ERROR', count: 15 }
        ]
      };

      const alerts = alertManager.checkBatch(failedBatch);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].type).toBe('LOW_SUCCESS_RATE');
      expect(alerts[1].type).toBe('HIGH_ERROR_RATE');
    });
  });

  describe('Batch Recovery and Resilience', () => {
    it('should implement automatic retry for failed exports', async () => {
      const retryPolicy = {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      };

      const failedExports = [
        { insightId: 'INS-2024-11-001', failureCount: 0 },
        { insightId: 'INS-2024-11-002', failureCount: 1 },
        { insightId: 'INS-2024-11-003', failureCount: 2 }
      ];

      const retryResults = await batchExporter.retryFailed(failedExports, retryPolicy);

      expect(retryResults.retried).toBe(3);
      expect(retryResults.successful).toBeGreaterThanOrEqual(0);
      expect(retryResults.permanentFailures).toBeLessThanOrEqual(3);
    });

    it('should save batch state for recovery after crashes', async () => {
      const batchState = {
        batchId: 'BATCH-2024-11-003',
        processed: 45,
        total: 100,
        currentIndex: 45,
        checkpoint: new Date()
      };

      await batchExporter.saveCheckpoint(batchState);

      // Simulate crash and recovery
      const newExporter = new BatchExporter({ region: 'eu-north-1' });
      const recoveredState = await newExporter.recoverFromCheckpoint('BATCH-2024-11-003');

      expect(recoveredState.processed).toBe(45);
      expect(recoveredState.remainingExports).toBe(55);
      expect(recoveredState.canResume).toBe(true);
    });

    it('should implement circuit breaker for failing services', async () => {
      const circuitBreaker = batchExporter.getCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenRequests: 3
      });

      // Simulate failures
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(() => Promise.reject(new Error('Service error')))
          .catch(() => {});
      }

      expect(circuitBreaker.getState()).toBe('open');
      
      // Should reject immediately when open
      await expect(
        circuitBreaker.execute(() => Promise.resolve('success'))
      ).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Batch Optimization', () => {
    it('should optimize batch size based on performance metrics', async () => {
      const optimizer = batchExporter.getBatchOptimizer();

      const metrics = {
        batchSize: 100,
        processingTime: 120000, // 2 minutes
        successRate: 98,
        avgExportTime: 1200, // 1.2 seconds
        resourceUtilization: {
          cpu: 65,
          memory: 70,
          network: 45
        }
      };

      const optimized = optimizer.calculateOptimalBatchSize(metrics);

      expect(optimized.recommendedSize).toBeGreaterThan(0);
      expect(optimized.reasoning).toBeDefined();
      expect(optimized.expectedImprovement).toBeGreaterThan(0);
    });

    it('should implement adaptive batching strategies', async () => {
      const adaptiveBatcher = batchExporter.createAdaptiveBatcher({
        initialSize: 50,
        minSize: 10,
        maxSize: 200,
        targetDuration: 60000 // 1 minute target
      });

      // Process several batches and learn
      for (let i = 0; i < 5; i++) {
        const result = await adaptiveBatcher.processBatch();
        adaptiveBatcher.learn(result);
      }

      const currentSize = adaptiveBatcher.getCurrentBatchSize();
      expect(currentSize).toBeGreaterThanOrEqual(10);
      expect(currentSize).toBeLessThanOrEqual(200);
    });

    it('should distribute batch load across time windows', async () => {
      const loadBalancer = batchExporter.createLoadBalancer({
        timeWindows: [
          { start: '00:00', end: '06:00', weight: 0.4 }, // Night - high load
          { start: '06:00', end: '18:00', weight: 0.1 }, // Day - low load
          { start: '18:00', end: '00:00', weight: 0.3 }  // Evening - medium
        ]
      });

      const exports = Array(1000).fill(null).map((_, i) => ({
        insightId: `INS-2024-11-${String(i).padStart(3, '0')}`,
        priority: Math.floor(Math.random() * 3)
      }));

      const distribution = loadBalancer.distribute(exports);

      expect(distribution.night.length).toBeGreaterThan(distribution.day.length);
      expect(distribution.totalScheduled).toBe(1000);
    });
  });
});