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
  const cleanA = cpfA.trim().toLowerCase();
  const cleanB = cpfB.trim().toLowerCase();
  
  // Extract only digits and asterisk/x characters
  const charsA = cleanA.split('').filter(c => /\d|\*|x/.test(c));
  const charsB = cleanB.split('').filter(c => /\d|\*|x/.test(c));
  
  if (charsA.length !== 11 || charsB.length !== 11) {
    // Loose matching if either doesn't match standard length (could be partially formatted or unformatted)
    const digitsA = cleanA.replace(/\D/g, '');
    const digitsB = cleanB.replace(/\D/g, '');
    if (digitsA.length > 0 && digitsB.length > 0) {
      if (digitsA === digitsB) return true;
      if (digitsA.includes(digitsB) || digitsB.includes(digitsA)) {
        return Math.min(digitsA.length, digitsB.length) >= 6;
      }
    }
    return false;
  }
  
  let matchCount = 0;
  let nonMaskCount = 0;
  for (let i = 0; i < 11; i++) {
    const charA = charsA[i];
    const charB = charsB[i];
    const isMaskA = charA === '*' || charA === 'x';
    const isMaskB = charB === '*' || charB === 'x';
    
    if (!isMaskA && !isMaskB) {
      nonMaskCount++;
      if (charA === charB) {
        matchCount++;
      } else {
        return false; // Concrete mismatch
      }
    }
  }
  
  // We require at least 3 concrete matched digits to avoid empty matching on fully masked fields
  return nonMaskCount >= 3 && matchCount === nonMaskCount;
}

/**
 * Extracts clean name and CPF from a transaction description format (e.g., "JOAO SILVA - 123.456.789-00" or "Pix Recebido Joao, CPF ***.001.009-**")
 */
export function extractNameAndCpf(description: string): { name: string; cpf: string | null } {
  if (!description) {
    return { name: '', cpf: null };
  }

  // SICOOB or other format: "NAME - CPF/CNPJ" or similar
  const parts = description.split(' - ');
  let name = parts[0].trim();
  let cpf: string | null = null;

  // Pattern for masked/normal CPF: e.g., ***.001.009-** or 123.456.789-00
  const cpfRegex = /([\d*xX]{3}\.[\d*xX]{3}\.[\d*xX]{3}-[\d*xX]{2})|([\d*xX]{11})/;

  if (parts.length > 1) {
    const rawCpf = parts[1].trim();
    if (cpfRegex.test(rawCpf)) {
      cpf = rawCpf;
    }
  }

  // Attempt regex fallback if cpf not set or not separated by ' - '
  if (!cpf) {
    const cpfMatch = description.match(cpfRegex);
    if (cpfMatch) {
      cpf = cpfMatch[0];
      name = description.replace(cpf, '').trim();
    }
  }

  // Remove trailing/leading "CPF", "CPF:", "CPF/CNPJ", etc from name and description
  name = name.replace(/(CPF|CNPJ|CPF\/CNPJ|DOCUMENTO|DOC):?\s*[\d*xX.#_-]*\s*\**\*?\s*$/i, '').trim();
  name = name.replace(/,\s*$/, '').trim(); // remove trailing comma

  // Basic cleanup of name (remove words like PIX, RECEBIMENTO, etc)
  const prefixRegex = /^(RECEBIMENTO PIX|PAGAMENTO PIX|TED|DOC|PIX RECEB|PIX TRANSF|PIX ENTRADA|PIX DE RECEBIDO DE|PIX DE RECEBIDO|PIX RECEBIDO DE|PIX RECEBIDO|PIX DE|RECEBIDO DE|TRANSFERIDO POR|PIX ENTRADA DE|PIX ENVIADO POR|PAGTO|PAGAMENTO|TRANSF|TRANSFERENCIA DE|TRANSFERENCIA)\s+/i;
  name = name.replace(prefixRegex, '').trim();

  // Strip trailing punctuation or special non-alphanumeric chars
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
