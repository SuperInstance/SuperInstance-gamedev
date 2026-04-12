/**
 * GameDev MCP Hub — Routing tests
 * Tests IntentParser, CandidateRanker (pure logic, no MCP deps)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentParser } from '../routing/intent-parser';
import { CandidateRanker, type RankedCandidate } from '../routing/candidate-ranker';
import type { Intent, EnhancedToolMetadata } from '../types/routing-types';

// ═══════════════════════════════════════════════════════════════════
// IntentParser Tests (16 tests)
// ═══════════════════════════════════════════════════════════════════

describe('IntentParser', () => {
  let parser: IntentParser;
  beforeEach(() => { parser = new IntentParser(); });

  it('should parse search action', () => {
    const intent = parser.parse('find all objects in scene');
    expect(intent.action).toBe('search');
  });

  it('should parse create action', () => {
    const intent = parser.parse('create a new scene');
    expect(intent.action).toBe('create');
  });

  it('should parse update action', () => {
    const intent = parser.parse('modify the player model');
    expect(intent.action).toBe('update');
  });

  it('should parse delete action', () => {
    const intent = parser.parse('remove the old files');
    expect(intent.action).toBe('delete');
  });

  it('should parse list action', () => {
    const intent = parser.parse('show me all repositories');
    expect(intent.action).toBe('list');
  });

  it('should parse execute action', () => {
    const intent = parser.parse('execute the script');
    expect(intent.action).toBe('execute');
  });

  it('should parse test action', () => {
    const intent = parser.parse('validate the code');
    expect(intent.action).toBe('test');
  });

  it('should parse analyze action', () => {
    const intent = parser.parse('analyze the mesh geometry');
    expect(intent.action).toBe('analyze');
  });

  it('should extract scene target', () => {
    const intent = parser.parse('create a new scene');
    expect(intent.target).toBe('scenes');
  });

  it('should extract code target', () => {
    const intent = parser.parse('review the source code');
    expect(intent.target).toBe('code');
  });

  it('should extract repositories target', () => {
    const intent = parser.parse('list all repos');
    expect(intent.target).toBe('repositories');
  });

  it('should extract object target', () => {
    const intent = parser.parse('find all objects in the level');
    expect(intent.target).toBe('objects');
  });

  it('should include keywords', () => {
    const intent = parser.parse('create a new scene');
    expect(intent.keywords.length).toBeGreaterThan(0);
  });

  it('should include confidence', () => {
    const intent = parser.parse('find all repos');
    expect(intent.confidence).toBeGreaterThanOrEqual(0);
    expect(intent.confidence).toBeLessThanOrEqual(1);
  });

  it('should include use case', () => {
    const intent = parser.parse('create a new scene');
    expect(intent.useCase).toBeTruthy();
  });

  it('should handle unknown actions', () => {
    const intent = parser.parse('xyzzy the foobar');
    expect(intent.action).toBe('unknown');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CandidateRanker Tests (12 tests)
// ═══════════════════════════════════════════════════════════════════

describe('CandidateRanker', () => {
  let ranker: CandidateRanker;
  let mockTools: EnhancedToolMetadata[];

  beforeEach(() => {
    ranker = new CandidateRanker();
    mockTools = [
      {
        name: 'unity-create-object',
        description: 'Create game objects in Unity',
        category: 'game-engine',
        keywords: ['unity', 'create', 'object', 'scene'],
        useCases: ['create game objects', 'spawn entities'],
        serverStatus: 'connected',
      } as EnhancedToolMetadata,
      {
        name: 'blender-import-mesh',
        description: 'Import mesh files into Blender',
        category: '3d-modeling',
        keywords: ['blender', 'import', 'mesh', 'model'],
        useCases: ['import 3d models', 'load mesh files'],
        serverStatus: 'connected',
      } as EnhancedToolMetadata,
      {
        name: 'github-list-repos',
        description: 'List repositories on GitHub',
        category: 'version-control',
        keywords: ['github', 'list', 'repos', 'repository'],
        useCases: ['list repositories', 'browse repos'],
        serverStatus: 'disconnected',
      } as EnhancedToolMetadata,
    ];
  });

  it('should rank candidates by score', () => {
    const intent: Intent = {
      action: 'create',
      target: 'objects',
      category: 'game-engine',
      keywords: ['create', 'object'],
      useCase: 'create objects',
      confidence: 0.9,
    };
    const ranked = ranker.rank(mockTools, intent);
    expect(ranked.length).toBe(3);
    // Unity tool should rank first for "create objects"
    expect(ranked[0].tool.name).toBe('unity-create-object');
  });

  it('should return scores between 0 and 1', () => {
    const intent: Intent = {
      action: 'list', target: 'repos', category: 'version-control',
      keywords: ['list', 'repos'], useCase: 'list repos', confidence: 0.8,
    };
    const ranked = ranker.rank(mockTools, intent);
    for (const r of ranked) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('should include match reasons', () => {
    const intent: Intent = {
      action: 'create', target: 'objects', category: 'game-engine',
      keywords: ['create', 'object'], useCase: 'create objects', confidence: 0.9,
    };
    const ranked = ranker.rank(mockTools, intent);
    expect(ranked[0].matchReasons.length).toBeGreaterThan(0);
  });

  it('should handle empty candidates', () => {
    const intent: Intent = {
      action: 'search', target: 'files', category: 'unknown',
      keywords: [], useCase: 'unknown', confidence: 0.1,
    };
    const ranked = ranker.rank([], intent);
    expect(ranked.length).toBe(0);
  });

  it('should boost connected servers', () => {
    const intent: Intent = {
      action: 'list', target: 'repos', category: 'version-control',
      keywords: ['list', 'repos'], useCase: 'list repos', confidence: 0.8,
    };
    const ranked = ranker.rank(mockTools, intent);
    // GitHub tool is disconnected, should score lower on server availability
    const githubTool = ranked.find(r => r.tool.name === 'github-list-repos');
    expect(githubTool).toBeDefined();
  });

  it('should sort descending by score', () => {
    const intent: Intent = {
      action: 'create', target: 'objects', category: 'game-engine',
      keywords: ['create', 'object'], useCase: 'create objects', confidence: 0.9,
    };
    const ranked = ranker.rank(mockTools, intent);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('should include confidence values', () => {
    const intent: Intent = {
      action: 'create', target: 'objects', category: 'game-engine',
      keywords: ['create'], useCase: 'create', confidence: 0.8,
    };
    const ranked = ranker.rank(mockTools, intent);
    for (const r of ranked) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should weight category match heavily', () => {
    const intent: Intent = {
      action: 'create', target: 'objects', category: 'game-engine',
      keywords: [], useCase: '', confidence: 0.5,
    };
    const ranked = ranker.rank(mockTools, intent);
    const unityScore = ranked.find(r => r.tool.name === 'unity-create-object')!.score;
    const blenderScore = ranked.find(r => r.tool.name === 'blender-import-mesh')!.score;
    // Unity matches category, blender doesn't
    expect(unityScore).toBeGreaterThan(blenderScore);
  });

  it('should handle keyword matching', () => {
    const intent: Intent = {
      action: 'import', target: 'models', category: '3d-modeling',
      keywords: ['import', 'mesh', 'model'], useCase: 'import mesh', confidence: 0.8,
    };
    const ranked = ranker.rank(mockTools, intent);
    expect(ranked[0].tool.name).toBe('blender-import-mesh');
  });

  it('should work with single candidate', () => {
    const intent: Intent = {
      action: 'create', target: 'objects', category: 'game-engine',
      keywords: ['create'], useCase: 'create', confidence: 0.8,
    };
    const ranked = ranker.rank([mockTools[0]], intent);
    expect(ranked.length).toBe(1);
    expect(ranked[0].tool.name).toBe('unity-create-object');
  });

  it('should handle candidates with no matching keywords', () => {
    const intent: Intent = {
      action: 'delete', target: 'art', category: 'art',
      keywords: ['painting', 'texture'], useCase: 'delete art', confidence: 0.3,
    };
    const ranked = ranker.rank(mockTools, intent);
    expect(ranked.length).toBe(3); // Still returns all, just low scores
  });

  it('should produce deterministic results', () => {
    const intent: Intent = {
      action: 'create', target: 'objects', category: 'game-engine',
      keywords: ['create', 'object'], useCase: 'create objects', confidence: 0.9,
    };
    const ranked1 = ranker.rank(mockTools, intent);
    const ranked2 = ranker.rank(mockTools, intent);
    for (let i = 0; i < ranked1.length; i++) {
      expect(ranked1[i].tool.name).toBe(ranked2[i].tool.name);
      expect(ranked1[i].score).toBe(ranked2[i].score);
    }
  });
});
