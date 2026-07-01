/**
 * Helper utilities for contributor auto-processing and similarity checks
 */

import { Contributor, ContributorFile } from '../types';
import { calculateNameSimilarity } from '../services/processingService';

/**
 * Extracts clean name and CPF from a transaction description format (e.g., "JOAO SILVA - 123.456.789-00")
 */
export function extractNameAndCpf(description: string): { name: string; cpf: string | null } {
  if (!description) {
    return { name: '', cpf: null };
  }

  // SICOOB or other format: "NAME - CPF/CNPJ" or similar
  const parts = description.split(' - ');
  let name = parts[0].trim();
  let cpf: string | null = null;

  if (parts.length > 1) {
    const rawCpf = parts[1].replace(/\D/g, '');
    if (rawCpf.length === 11 || rawCpf.length === 14) {
      cpf = parts[1].trim();
    }
  }

  // Attempt regex fallback if cpf not set or not separated by ' - '
  if (!cpf) {
    const cpfMatch = description.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})|(\d{11})/);
    if (cpfMatch) {
      cpf = cpfMatch[0];
      name = description.replace(cpf, '').replace(' - ', '').trim();
    }
  }

  // Basic cleanup of name (remove words like PIX, RECEBIMENTO, etc)
  const prefixRegex = /^(RECEBIMENTO PIX|PAGAMENTO PIX|TED|DOC|PIX RECEB|PIX TRANSF|PIX ENTRADA)\s+/i;
  name = name.replace(prefixRegex, '').trim();

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
  const targetCpfClean = targetCpf ? targetCpf.replace(/\D/g, '') : null;

  contributorFiles.forEach(file => {
    (file.contributors || []).forEach(c => {
      // CPF Match is 100% priority
      if (targetCpfClean && c.cpf) {
        const cCpfClean = c.cpf.replace(/\D/g, '');
        if (cCpfClean === targetCpfClean) {
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
