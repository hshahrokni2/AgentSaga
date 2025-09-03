#!/usr/bin/env python3
"""
Update PROJECT_INDEX.json with current project structure
"""

import json
import os
from pathlib import Path
from datetime import datetime
import hashlib

def get_file_tree(root_path='.', exclude_dirs=None):
    """Generate a file tree structure"""
    if exclude_dirs is None:
        exclude_dirs = {
            'node_modules', 'venv', '.git', '.next', 'dist', 'build',
            '__pycache__', '.pytest_cache', '.venv', 'env', '.env'
        }
    
    tree = []
    file_count = {'typescript': 0, 'python': 0, 'javascript': 0, 'json': 0, 'markdown': 0}
    
    for root, dirs, files in os.walk(root_path):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        
        level = root.replace(root_path, '').count(os.sep)
        indent = ' ' * 2 * level
        folder_name = os.path.basename(root)
        
        if level == 0:
            tree.append('.')
        else:
            tree.append(f'{indent}├── {folder_name}/')
        
        # Count files by type
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                file_count['typescript'] += 1
            elif file.endswith('.py'):
                file_count['python'] += 1
            elif file.endswith('.js') or file.endswith('.jsx'):
                file_count['javascript'] += 1
            elif file.endswith('.json'):
                file_count['json'] += 1
            elif file.endswith('.md'):
                file_count['markdown'] += 1
    
    return tree, file_count

def get_file_functions(file_path):
    """Extract functions from a file"""
    functions = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if file_path.endswith(('.ts', '.tsx', '.js', '.jsx')):
            # Simple TypeScript/JavaScript function extraction
            import re
            # Match function declarations, arrow functions, and class methods
            patterns = [
                r'(?:export\s+)?(?:async\s+)?function\s+(\w+)',
                r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>',
                r'(?:async\s+)?(\w+)\s*\([^)]*\)\s*{',  # Class methods
                r'class\s+(\w+)',  # Classes
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, content)
                functions.extend(matches)
                
        elif file_path.endswith('.py'):
            # Python function extraction
            import re
            patterns = [
                r'def\s+(\w+)\s*\(',
                r'class\s+(\w+)',
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, content)
                functions.extend(matches)
    except:
        pass
    
    return list(set(functions))  # Remove duplicates

def create_index():
    """Create PROJECT_INDEX.json"""
    
    # Get file tree and counts
    tree, file_count = get_file_tree()
    
    # Build the index structure
    index = {
        'at': datetime.now().isoformat(),
        'root': '.',
        'tree': tree[:20],  # Limit tree display
        'stats': {
            'total_files': sum(file_count.values()),
            'total_directories': len([t for t in tree if '/' in t]),
            'fully_parsed': file_count,
            'markdown_files': file_count['markdown']
        },
        'f': {}  # File details
    }
    
    # Add details for key files
    key_patterns = [
        'src/services/*.py',
        'src/services/*.ts',
        'src/services/llm-tools/**/*.ts',
        'components/**/*.tsx',
        'tests/*.py',
        'tests/**/*.ts'
    ]
    
    from glob import glob
    
    for pattern in key_patterns:
        for file_path in glob(pattern, recursive=True):
            if os.path.isfile(file_path):
                functions = get_file_functions(file_path)
                if functions:
                    # Store with relative path
                    rel_path = file_path.replace('./', '')
                    
                    if file_path.endswith('.py'):
                        index['f'][rel_path] = ['p', functions[:10]]  # Limit to 10 functions
                    else:
                        index['f'][rel_path] = ['t', functions[:10]]
    
    # Add dependencies graph (simplified)
    index['g'] = []  # Dependencies would go here
    
    # Add directory purposes
    index['dir_purposes'] = {
        'src/services': 'Business logic and service implementations',
        'src/services/llm-tools': 'LLM tool server and function calling',
        'components': 'React UI components',
        'components/copilot': 'AI copilot interface components',
        'components/scenario-lab': 'Scenario planning UI',
        'tests': 'Test suites and test utilities',
        'config': 'Configuration files'
    }
    
    # Calculate staleness (seconds since epoch)
    index['staleness'] = int(datetime.now().timestamp())
    
    return index

def main():
    """Main function"""
    print("Updating PROJECT_INDEX.json...")
    
    # Create the index
    index = create_index()
    
    # Write to file
    with open('PROJECT_INDEX.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Updated PROJECT_INDEX.json")
    print(f"   - Total files: {index['stats']['total_files']}")
    print(f"   - TypeScript files: {index['stats']['fully_parsed']['typescript']}")
    print(f"   - Python files: {index['stats']['fully_parsed']['python']}")
    print(f"   - Functions indexed: {sum(len(v[1]) if isinstance(v, list) else 0 for v in index['f'].values())}")

if __name__ == '__main__':
    main()