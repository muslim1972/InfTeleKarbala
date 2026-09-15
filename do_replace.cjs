const fs = require('fs');
let content = fs.readFileSync('D:/InfTeleKarbala/src/components/admin/FinancialDataUpdater.tsx', 'utf-8');

const oldBlock =                     // 2. Automated Certificate Percentage
                    if (updates['certificate_text']) {
                        let certText = updates['certificate_text'].to || '';
                        let extractedPerc = null;
                        let extractedName = certText;

                        // Case A: Extract percentage e.g. "ماجستير بنسبة 125"
                        const matchPercentage = certText.match(/(?:بنسبة|نسبة)\\s*(\\d{2,3})/);
                        if (matchPercentage && matchPercentage[1]) {
                            extractedPerc = parseInt(matchPercentage[1], 10);
                            extractedName = certText.replace(matchPercentage[0], '').replace(/[%-]/g, '').trim();
                        }

                        let toValue = extractedPerc;

                        // Case B: Match predefined certificates
                        const certDef = CERTIFICATES.find(c => 
                            extractedName === c.label || 
                            extractedName.includes(c.label) ||
                            (c.aliases && c.aliases.some(a => extractedName.includes(a))) ||
                            normalizeForComparison(extractedName) === normalizeForComparison(c.label)
                        );
                        
                        if (certDef) {
                            extractedName = certDef.label; // Clean standard name
                            if (toValue === null) toValue = certDef.percentage;
                        }

                        if (extractedName !== certText) {
                            updates['certificate_text'].to = extractedName;
                            updates['certificate_text'].modified = (existing ? existing['certificate_text'] : null) !== extractedName;
                        }

                        if (toValue !== null) {
                            const fromValue = existing ? existing['certificate_percentage'] : null;
                            const modified = Number(fromValue) !== Number(toValue);
                            
                            updates['certificate_percentage'] = {
                                from: fromValue,
                                to: toValue,
                                modified: modified
                            };
                            if (modified) hasChanges = true;
                        }
                    };

const newBlock =                     // 2. Automated Certificate Percentage
                    if (updates['certificate_text']) {
                        const { percentage, text: cleanName } = extractPercentageFromText(updates['certificate_text'].to || '');
                        let finalName = cleanName;
                        let finalPerc = percentage;

                        const certDef = CERTIFICATES.find(c => 
                            finalName === c.label || 
                            finalName.includes(c.label) ||
                            (c.aliases && c.aliases.some(a => finalName.includes(a))) ||
                            normalizeForComparison(finalName) === normalizeForComparison(c.label)
                        );

                        if (certDef) {
                            finalName = certDef.label;
                            if (finalPerc === null) finalPerc = certDef.percentage;
                        }

                        if (finalName !== updates['certificate_text'].to) {
                            updates['certificate_text'].to = finalName;
                            updates['certificate_text'].modified = (existing ? existing['certificate_text'] : null) !== finalName;
                        }

                        if (finalPerc !== null) {
                            const fromValue = existing ? existing['certificate_percentage'] : null;
                            const modified = Number(fromValue) !== Number(finalPerc);
                            updates['certificate_percentage'] = { from: fromValue, to: finalPerc, modified };
                            if (modified) hasChanges = true;
                        }
                    }

                    // 3. Robust Data Validation against Math Rules
                    const virtualRecord: any = { ...existing };
                    // Apply all updates to virtual record to see what the final math looks like
                    Object.keys(updates).forEach(k => {
                        if (updates[k] && updates[k].to !== undefined) {
                            virtualRecord[k] = updates[k].to;
                        }
                    });
                    
                    const validation = validateFinancialRecord(virtualRecord);
                    updates.validation = validation; // Store the validation results so the UI can flag them
                    if (Object.keys(validation.discrepancies).length > 0) {
                        hasChanges = true; // Force it to show if there are math discrepancies so admin can review
                    };

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('D:/InfTeleKarbala/src/components/admin/FinancialDataUpdater.tsx', content, 'utf-8');
