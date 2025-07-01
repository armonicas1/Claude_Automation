/**
 * Module Utilities for Compatibility
 * 
 * This file provides helper functions to bridge between ESM and CommonJS modules.
 * It helps resolve "require is not defined" errors in ESM contexts.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Create a require function that can be used in ESM
const moduleRequire = createRequire(import.meta.url);

/**
 * Import a module using either ESM import or CommonJS require based on availability
 * @param {string} modulePath - Path to the module
 * @returns {Promise<any>} - The imported module
 */
export async function importModule(modulePath) {
    try {
        // Try ESM import first
        return await import(modulePath).then(m => m.default || m);
    } catch (error) {
        // Fall back to CommonJS require
        try {
            return moduleRequire(modulePath);
        } catch (innerError) {
            console.error(`Failed to import module ${modulePath}:`, innerError);
            throw innerError;
        }
    }
}

/**
 * Get the directory name of the current module (equivalent to __dirname in CommonJS)
 * @param {string} importMetaUrl - import.meta.url from the calling module
 * @returns {string} - The directory path
 */
export function getDirname(importMetaUrl) {
    return dirname(fileURLToPath(importMetaUrl));
}

/**
 * Load plugins from a directory supporting both ESM and CommonJS
 * @param {string} pluginsDir - Directory containing plugin files
 * @returns {Promise<Array>} - Array of loaded plugins
 */
export async function loadPlugins(pluginsDir) {
    const plugins = [];
    
    if (fs.existsSync(pluginsDir)) {
        const files = fs.readdirSync(pluginsDir);
        for (const file of files) {
            if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')) {
                try {
                    const pluginPath = path.join(pluginsDir, file);
                    console.log(`Loading plugin: ${pluginPath}`);
                    
                    // Handle different file extensions
                    if (file.endsWith('.cjs')) {
                        // CommonJS module
                        plugins.push(moduleRequire(pluginPath));
                    } else {
                        // Try ESM import
                        const plugin = await import(`file://${pluginPath}`);
                        plugins.push(plugin.default || plugin);
                    }
                    
                    console.log(`Successfully loaded plugin: ${file}`);
                } catch (err) {
                    console.error(`Error loading plugin ${file}:`, err);
                }
            }
        }
    }
    
    return plugins;
}
