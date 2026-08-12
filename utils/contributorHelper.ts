/**
 * Helper utilities for contributor auto-processing and similarity checks
 */

import { Contributor, ContributorFile } from '../types';
import { calculateNameSimilarity } from '../services/processingService';

/**
 * Checks if two CPFs are compatible, allowing for masking (e.g. ***.001.009-** vs 000.001.009-00)
 */
export function isCpfCompatible(cpfA: string | null, cpfB: string | null): boolean {
  if (!cpfA || !cpfB) return false;
  const strA = cpfA.trim().toUpperCase();
  const strB = cpfB.trim().toUpperCase();
  
  // Extract digits only
  const digitsA = strA.replace(/\D/g, '');
  const digitsB = strB.replace(/\D/g, '');
  
  // Direct digit match (if both have at least 6 digits)
  if (digitsA.length >= 6 && digitsB.length >= 6) {
    if (digitsA === digitsB) return true;
    if (digitsA.length >= 6 && digitsB.includes(digitsA)) return true;
    if (digitsB.length >= 6 && digitsA.includes(digitsB)) return true;
  }
  
  // Position-by-position masked comparison (for 11-digit CPF or 14-digit CNPJ)
  const charsA = strA.split('').filter(c => /[\d*X]/i.test(c));
  const charsB = strB.split('').filter(c => /[\d*X]/i.test(c));
  
  if (charsA.length === 11 && charsB.length === 11) {
    let matchCount = 0;
    let nonMaskCount = 0;
    let mismatch = false;
    
    for (let i = 0; i < 11; i++) {
      const ca = charsA[i];
      const cb = charsB[i];
      const isMaskA = ca === '*' || ca === 'X';
      const isMaskB = cb === '*' || cb === 'X';
      
      if (!isMaskA && !isMaskB) {
        nonMaskCount++;
        if (ca === cb) {
          matchCount++;
        } else {
          mismatch = true;
          break;
        }
      }
    }
    
    if (!mismatch && nonMaskCount >= 4 && matchCount === nonMaskCount) {
      return true;
    }
  }

  if (charsA.length === 14 && charsB.length === 14) {
    let matchCount = 0;
    let nonMaskCount = 0;
    let mismatch = false;
    
    for (let i = 0; i < 14; i++) {
      const ca = charsA[i];
      const cb = charsB[i];
      const isMaskA = ca === '*' || ca === 'X';
      const isMaskB = cb === '*' || cb === 'X';
      
      if (!isMaskA && !isMaskB) {
        nonMaskCount++;
        if (ca === cb) {
          matchCount++;
        } else {
          mismatch = true;
          break;
        }
      }
    }
    
    if (!mismatch && nonMaskCount >= 5 && matchCount === nonMaskCount) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extracts clean name and CPF/CNPJ (including masked or partial digits) from a transaction description.
 */
export function extractNameAndCpf(description: string): { name: string; cpf: string | null } {
  if (!description) {
    return { name: '', cpf: null };
  }

  let text = description.trim();
  let cpf: string | null = null;

  // Regex patterns for CPF / CNPJ / Masked CPF / Partial digit sequences
  // 1. Formatted CPF: e.g. 123.456.789-00 or ***.196.901-**
  const formattedCpfRegex = /([\d*xX]{3}\.[\d*xX]{3}\.[\d*xX]{3}-[\d*xX]{2})/i;
  // 2. Formatted CNPJ: e.g. 12.345.678/0001-90 or **.345.678/0001-**
  const formattedCnpjRegex = /([\d*xX]{2}\.[\d*xX]{3}\.[\d*xX]{3}\/[\d*xX]{4}-[\d*xX]{2})/i;
  // 3. Unformatted masked CPF/CNPJ or 11-14 char digits with mask (e.g. ***196901**, ***19690120)
  const maskedCpfRegex = /(\*{2,4}[\d]{5,8}\*{0,4})|([\d*xX]{11,14})/i;
  // 4. Standalone digit sequence of 6 to 14 digits (e.g. 196901, 035802, 41592215)
  const standaloneDigitsRegex = /\b\d{6,14}\b/;

  // Try matching formatted CPF first
  let match = text.match(formattedCpfRegex) || text.match(formattedCnpjRegex);
  if (match) {
    cpf = match[0];
  } else {
    // Try masked CPF regex
    match = text.match(maskedCpfRegex);
    if (match && (match[0].replace(/\D/g, '').length >= 5 || match[0].includes('*'))) {
      cpf = match[0];
    } else {
      // Try standalone digits
      match = text.match(standaloneDigitsRegex);
      if (match) {
        cpf = match[0];
      }
    }
  }

  // Extract name by removing the matched CPF from text
  let name = text;
  if (cpf) {
    name = text.replace(cpf, '').trim();
  }

  // Handle "NAME - CPF" pattern if hyphen exists
  if (name.includes(' - ')) {
    const parts = name.split(' - ');
    if (parts.length > 1) {
      name = parts[0].trim();
    }
  }

  // Remove trailing/leading "CPF", "CNPJ", "DOC", etc.
  name = name.replace(/(CPF|CNPJ|CPF\/CNPJ|DOCUMENTO|DOC):?\s*[\d*xX.#_-]*\s*\**\*?\s*$/i, '').trim();
  name = name.replace(/,\s*$/, '').trim();

  // Remove common bank operational prefixes
  const prefixRegex = /^(RECEBIMENTO PIX|PAGAMENTO PIX|TED|DOC|PIX RECEB|PIX TRANSF|PIX ENTRADA|PIX DE RECEBIDO DE|PIX DE RECEBIDO|PIX RECEBIDO DE|PIX RECEBIDO|PIX DE|RECEBIDO DE|TRANSFERIDO POR|PIX ENTRADA DE|PIX ENVIADO POR|PAGTO|PAGAMENTO|TRANSF|TRANSFERENCIA DE|TRANSFERENCIA|REM\.:?)\s+/i;
  name = name.replace(prefixRegex, '').trim();

  // Strip trailing punctuation
  name = name.replace(/[^a-zA-Z0-9À-ÿ\s]+$/, '').trim();

  return { name, cpf };
}

/**
 * Finds similar contributors in the database (loaded in contributorFiles)
 */
export function findSimilarContributors(
  targetName: string,
  targetCpf: string | null,
  contributorFiles: ContributorFile[],
  minScore = 40
): Array<{ contributor: any; church: any; score: number }> {
  if (!targetName && !targetCpf) return [];

  const results: Array<{ contributor: any; church: any; score: number }> = [];
  const targetNameNorm = targetName.toUpperCase().trim();

  contributorFiles.forEach(file => {
    (file.contributors || []).forEach(c => {
      // CPF Match (including compatibility checks)
      if (targetCpf && c.cpf) {
        if (isCpfCompatible(targetCpf, c.cpf)) {
          results.push({
            contributor: c,
            church: file.church,
            score: 100
          });
          return;
        }
      }

      // Fuzzy Name Similarity Match
      const pseudoContributor: Contributor = {
        name: c.name || c.canonical_name || '',
        amount: 0
      };

      const score = calculateNameSimilarity(targetNameNorm, pseudoContributor);
      if (score >= minScore) {
        results.push({
          contributor: c,
          church: file.church,
          score: Math.round(score)
        });
      }
    });
  });

  // Sort by highest score first
  return results.sort((a, b) => b.score - a.score);
}
