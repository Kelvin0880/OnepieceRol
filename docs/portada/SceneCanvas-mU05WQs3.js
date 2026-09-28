import{_ as e,a as t,c as n,d as r,f as i,i as a,l as o,m as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"./index-Da4980SE.js";import{A as h,B as g,C as ee,D as te,E as ne,H as _,I as v,K as y,L as re,M as ie,N as ae,O as b,P as oe,R as se,S as ce,T as le,U as ue,V as x,W as de,X as fe,Y as pe,Z as S,_ as me,a as he,at as ge,b as C,c as _e,ct as ve,d as ye,dt as w,et as be,f as xe,ft as T,g as E,gt as Se,h as Ce,ht as we,i as D,it as Te,j as Ee,k as De,l as Oe,lt as ke,m as O,mt as k,n as Ae,o as je,ot as Me,p as Ne,pt as Pe,r as Fe,s as Ie,st as A,t as Le,tt as Re,u as ze,ut as Be,v as Ve,w as He,x as Ue,y as We,z as Ge}from"./Sparkles-CjSfCBwh.js";var j=e(s()),M=u();function Ke(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}new w,new w;function qe(e,t){if(!(e instanceof t))throw TypeError(`Cannot call a class as a function`)}var N=function e(t,n,r){var i=this;qe(this,e),Ke(this,`dot2`,function(e,t){return i.x*e+i.y*t}),Ke(this,`dot3`,function(e,t,n){return i.x*e+i.y*t+i.z*n}),this.x=t,this.y=n,this.z=r},Je=[new N(1,1,0),new N(-1,1,0),new N(1,-1,0),new N(-1,-1,0),new N(1,0,1),new N(-1,0,1),new N(1,0,-1),new N(-1,0,-1),new N(0,1,1),new N(0,-1,1),new N(0,1,-1),new N(0,-1,-1)],Ye=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180],Xe=Array(512),Ze=Array(512);(function(e){e>0&&e<1&&(e*=65536),e=Math.floor(e),e<256&&(e|=e<<8);for(var t=0;t<256;t++){var n=t&1?Ye[t]^e&255:Ye[t]^e>>8&255;Xe[t]=Xe[t+256]=n,Ze[t]=Ze[t+256]=Je[n%12]}})(0),.5*(Math.sqrt(3)-1),(3-Math.sqrt(3))/6;function Qe(e){if(typeof e==`number`)e=Math.abs(e);else if(typeof e==`string`){var t=e;e=0;for(var n=0;n<t.length;n++)e=(e+(n+1)*(t.charCodeAt(n)%96))%2147483647}return e===0&&(e=311),e}function $e(e){var t=Qe(e);return function(){var e=t*48271%2147483647;return t=e,e/2147483647}}new function e(t){var n=this;qe(this,e),Ke(this,`seed`,0),Ke(this,`init`,function(e){n.seed=e,n.value=$e(e)}),Ke(this,`value`,$e(this.seed)),this.init(t)}(Math.random());var et=parseInt(`186`.replace(/\D+/g,``)),tt=et>=125?`uv1`:`uv2`,nt=new _e,rt=new T,it=class extends ne{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new C([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new C([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new te(t,6,1);return this.setAttribute(`instanceStart`,new b(n,3,0)),this.setAttribute(`instanceEnd`,new b(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new te(n,t*2,1);return this.setAttribute(`instanceColorStart`,new b(r,t,0)),this.setAttribute(`instanceColorEnd`,new b(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new we(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new _e);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),nt.setFromBufferAttribute(t),this.boundingBox.union(nt))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new be),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)rt.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(rt)),rt.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(rt));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},at=class extends it{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},ot=class extends S{constructor(e){super({type:`LineMaterial`,uniforms:ve.clone(ve.merge([je.common,je.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new w(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${et>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},st=new Pe,ct=new T,lt=new T,P=new Pe,F=new Pe,I=new Pe,ut=new T,dt=new se,L=new h,ft=new T,pt=new _e,mt=new be,R=new Pe,z,ht;function gt(e,t,n){return R.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),R.multiplyScalar(1/R.w),R.x=ht/n.width,R.y=ht/n.height,R.applyMatrix4(e.projectionMatrixInverse),R.multiplyScalar(1/R.w),Math.abs(Math.max(R.x,R.y))}function _t(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){L.start.fromBufferAttribute(i,r),L.end.fromBufferAttribute(a,r),L.applyMatrix4(n);let o=new T,s=new T;z.distanceSqToSegment(L.start,L.end,s,o),s.distanceTo(o)<ht*.5&&t.push({point:s,pointOnLine:o,distance:z.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[tt]:null})}}function vt(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;z.at(1,I),I.w=1,I.applyMatrix4(t.matrixWorldInverse),I.applyMatrix4(r),I.multiplyScalar(1/I.w),I.x*=i.x/2,I.y*=i.y/2,I.z=0,ut.copy(I),dt.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(P.fromBufferAttribute(s,t),F.fromBufferAttribute(c,t),P.w=1,F.w=1,P.applyMatrix4(dt),F.applyMatrix4(dt),P.z>u&&F.z>u)continue;if(P.z>u){let e=P.z-F.z,t=(P.z-u)/e;P.lerp(F,t)}else if(F.z>u){let e=F.z-P.z,t=(F.z-u)/e;F.lerp(P,t)}P.applyMatrix4(r),F.applyMatrix4(r),P.multiplyScalar(1/P.w),F.multiplyScalar(1/F.w),P.x*=i.x/2,P.y*=i.y/2,F.x*=i.x/2,F.y*=i.y/2,L.start.copy(P),L.start.z=0,L.end.copy(F),L.end.z=0;let o=L.closestPointToPointParameter(ut,!0);L.at(o,ft);let l=re.lerp(P.z,F.z,o),d=l>=-1&&l<=1,f=ut.distanceTo(ft)<ht*.5;if(d&&f){L.start.fromBufferAttribute(s,t),L.end.fromBufferAttribute(c,t),L.start.applyMatrix4(a),L.end.applyMatrix4(a);let r=new T,i=new T;z.distanceSqToSegment(L.start,L.end,i,r),n.push({point:i,pointOnLine:r,distance:z.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[tt]:null})}}}var yt=class extends Ge{constructor(e=new it,t=new ot({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)ct.fromBufferAttribute(t,e),lt.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+ct.distanceTo(lt);let i=new te(r,2,1);return e.setAttribute(`instanceDistanceStart`,new b(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new b(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;z=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;ht=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),mt.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?ht*.5:gt(r,Math.max(r.near,mt.distanceToPoint(z.origin)),s.resolution),mt.radius+=c,z.intersectsSphere(mt)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),pt.copy(o.boundingBox).applyMatrix4(a);let l;l=n?ht*.5:gt(r,Math.max(r.near,pt.distanceToPoint(z.origin)),s.resolution),pt.expandByScalar(l),z.intersectsBox(pt)!==!1&&(n?_t(this,t):vt(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport(st),this.material.uniforms.resolution.value.set(st.z,st.w))}},bt=class extends yt{constructor(e=new at,t=new ot({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},xt=j.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:a,dashed:o,...s},c){var l;let u=he(e=>e.size),d=j.useMemo(()=>a?new yt:new bt,[a]),[f]=j.useState(()=>new ot),p=(n==null||(l=n[0])==null?void 0:l.length)===4?4:3,m=j.useMemo(()=>{let r=a?new it:new at,i=e.map(e=>{let t=Array.isArray(e);return e instanceof T||e instanceof Pe?[e.x,e.y,e.z]:e instanceof w?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof O?e.toArray():e);r.setColors(e.flat(),p)}return r},[e,a,n,p]);return j.useLayoutEffect(()=>{d.computeLineDistances()},[e,d]),j.useLayoutEffect(()=>{o?f.defines.USE_DASH=``:delete f.defines.USE_DASH,f.needsUpdate=!0},[o,f]),j.useEffect(()=>()=>{m.dispose(),f.dispose()},[m]),j.createElement(`primitive`,Se({object:d,ref:c},s),j.createElement(`primitive`,{object:m,attach:`geometry`}),j.createElement(`primitive`,Se({object:f,attach:`material`,color:t,vertexColors:!!n,resolution:[u.width,u.height],linewidth:r??i??1,dashed:o,transparent:p===4},s)))}),St=(0,j.createContext)(null);function Ct({iterations:e=10,ms:t=250,threshold:n=.75,step:r=.1,factor:i=.5,flipflops:a=1/0,bounds:o=e=>e>100?[60,100]:[40,60],onIncline:s,onDecline:c,onChange:l,onFallback:u,children:d}){let[f,p]=(0,j.useState)(()=>({fps:0,index:0,factor:i,flipped:0,refreshrate:0,fallback:!1,frames:[],averages:[],subscriptions:new Map,subscribe:e=>{let t=Symbol();return f.subscriptions.set(t,e.current),()=>void f.subscriptions.delete(t)}})),m=0;return D(()=>{let{frames:i,averages:d}=f;if(!f.fallback&&d.length<e){i.push(performance.now());let p=i[i.length-1]-i[0];if(p>=t){if(f.fps=Math.round(i.length/p*1e3*1)/1,f.refreshrate=Math.max(f.refreshrate,f.fps),d[f.index++%e]=f.fps,d.length===e){let[t,i]=o(f.refreshrate),p=d.filter(e=>e>=i),h=d.filter(e=>e<t);p.length>e*n&&(f.factor=Math.min(1,f.factor+r),f.flipped++,s&&s(f),f.subscriptions.forEach(e=>e.onIncline&&e.onIncline(f))),h.length>e*n&&(f.factor=Math.max(0,f.factor-r),f.flipped++,c&&c(f),f.subscriptions.forEach(e=>e.onDecline&&e.onDecline(f))),m!==f.factor&&(m=f.factor,l&&l(f),f.subscriptions.forEach(e=>e.onChange&&e.onChange(f))),f.flipped>a&&!f.fallback&&(f.fallback=!0,u&&u(f),f.subscriptions.forEach(e=>e.onFallback&&e.onFallback(f))),f.averages=[]}f.frames=[]}}}),j.createElement(St.Provider,{value:f},d)}var wt=(()=>{let e=new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),t=new Float32Array([0,0,2,0,0,2]),n=new ye;return n.setAttribute(`position`,new ze(e,3)),n.setAttribute(`uv`,new ze(t,2)),n})(),B=class e{static get fullscreenGeometry(){return wt}constructor(e=`Pass`,t=new fe,n=new ue){this.name=e,this.renderer=null,this.scene=t,this.camera=n,this.screen=null,this.rtt=!0,this.needsSwap=!0,this.needsDepthBlit=!1,this.needsDepthTexture=!1,this.enabled=!0}get renderToScreen(){return!this.rtt}set renderToScreen(e){if(this.rtt===e){let t=this.fullscreenMaterial;t!==null&&(t.needsUpdate=!0),this.rtt=!e}}set mainScene(e){}set mainCamera(e){}setRenderer(e){this.renderer=e}isEnabled(){return this.enabled}setEnabled(e){this.enabled=e}get fullscreenMaterial(){return this.screen===null?null:this.screen.material}set fullscreenMaterial(t){let n=this.screen;n===null?(n=new Ge(e.fullscreenGeometry,t),n.frustumCulled=!1,this.scene===null&&(this.scene=new fe),this.scene.add(n),this.screen=n):n.material=t}getFullscreenMaterial(){return this.fullscreenMaterial}setFullscreenMaterial(e){this.fullscreenMaterial=e}getDepthTexture(){return null}setDepthTexture(e,t=Ie){}render(e,t,n,r,i){throw Error(`Render method not implemented!`)}setSize(e,t){}initialize(e,t,n){}dispose(){for(let t of Object.keys(this)){let n=this[t];(n instanceof k||n instanceof v||n instanceof Te||n instanceof e)&&this[t].dispose()}this.fullscreenMaterial!==null&&this.fullscreenMaterial.dispose()}},Tt=class extends B{constructor(){super(`ClearMaskPass`,null,null),this.needsSwap=!1}render(e,t,n,r,i){let a=e.state.buffers.stencil;a.setLocked(!1),a.setTest(!1)}},Et=`#ifdef COLOR_WRITE
#include <common>
#include <dithering_pars_fragment>
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#endif
#ifdef DEPTH_WRITE
#include <packing>
#ifdef GL_FRAGMENT_PRECISION_HIGH
uniform highp sampler2D depthBuffer;
#else
uniform mediump sampler2D depthBuffer;
#endif
float readDepth(const in vec2 uv){
#if DEPTH_PACKING == 3201
return unpackRGBAToDepth(texture2D(depthBuffer,uv));
#else
return texture2D(depthBuffer,uv).r;
#endif
}
#endif
#ifdef USE_WEIGHTS
uniform vec4 channelWeights;
#endif
uniform float opacity;varying vec2 vUv;void main(){
#ifdef COLOR_WRITE
vec4 texel=texture2D(inputBuffer,vUv);
#ifdef USE_WEIGHTS
texel*=channelWeights;
#endif
gl_FragColor=opacity*texel;
#ifdef COLOR_SPACE_CONVERSION
#include <colorspace_fragment>
#endif
#include <dithering_fragment>
#else
gl_FragColor=vec4(0.0);
#endif
#ifdef DEPTH_WRITE
gl_FragDepth=readDepth(vUv);
#endif
}`,Dt=`varying vec2 vUv;void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}`,Ot=class extends S{constructor(){super({name:`CopyMaterial`,defines:{COLOR_SPACE_CONVERSION:`1`,DEPTH_PACKING:`0`,COLOR_WRITE:`1`},uniforms:{inputBuffer:new A(null),depthBuffer:new A(null),channelWeights:new A(null),opacity:new A(1)},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:Et,vertexShader:Dt}),this.depthFunc=1}get inputBuffer(){return this.uniforms.inputBuffer.value}set inputBuffer(e){let t=e!==null;this.colorWrite!==t&&(t?this.defines.COLOR_WRITE=!0:delete this.defines.COLOR_WRITE,this.colorWrite=t,this.needsUpdate=!0),this.uniforms.inputBuffer.value=e}get depthBuffer(){return this.uniforms.depthBuffer.value}set depthBuffer(e){let t=e!==null;this.depthWrite!==t&&(t?this.defines.DEPTH_WRITE=!0:delete this.defines.DEPTH_WRITE,this.depthTest=t,this.depthWrite=t,this.needsUpdate=!0),this.uniforms.depthBuffer.value=e}set depthPacking(e){this.defines.DEPTH_PACKING=e.toFixed(0),this.needsUpdate=!0}get colorSpaceConversion(){return this.defines.COLOR_SPACE_CONVERSION!==void 0}set colorSpaceConversion(e){this.colorSpaceConversion!==e&&(e?this.defines.COLOR_SPACE_CONVERSION=!0:delete this.defines.COLOR_SPACE_CONVERSION,this.needsUpdate=!0)}get channelWeights(){return this.uniforms.channelWeights.value}set channelWeights(e){e===null?delete this.defines.USE_WEIGHTS:(this.defines.USE_WEIGHTS=`1`,this.uniforms.channelWeights.value=e),this.needsUpdate=!0}setInputBuffer(e){this.uniforms.inputBuffer.value=e}getOpacity(e){return this.uniforms.opacity.value}setOpacity(e){this.uniforms.opacity.value=e}},kt=class extends B{constructor(e,t=!0){super(`CopyPass`),this.fullscreenMaterial=new Ot,this.needsSwap=!1,this.renderTarget=e,e===void 0&&(this.renderTarget=new k(1,1,{minFilter:ie,magFilter:ie,stencilBuffer:!1,depthBuffer:!1}),this.renderTarget.texture.name=`CopyPass.Target`),this.autoResize=t}get resize(){return this.autoResize}set resize(e){this.autoResize=e}get texture(){return this.renderTarget.texture}getTexture(){return this.renderTarget.texture}setAutoResizeEnabled(e){this.autoResize=e}render(e,t,n,r,i){this.fullscreenMaterial.inputBuffer=t.texture,e.setRenderTarget(this.renderToScreen?null:this.renderTarget),e.render(this.scene,this.camera)}setSize(e,t){this.autoResize&&this.renderTarget.setSize(e,t)}initialize(e,t,n){n!==void 0&&(this.renderTarget.texture.type=n,n===1009?e!==null&&e.outputColorSpace===`srgb`&&(this.renderTarget.texture.colorSpace=pe):this.fullscreenMaterial.defines.FRAMEBUFFER_PRECISION_HIGH=`1`)}},At=new O,jt=class extends B{constructor(e=!0,t=!0,n=!1){super(`ClearPass`,null,null),this.needsSwap=!1,this.color=e,this.depth=t,this.stencil=n,this.overrideClearColor=null,this.overrideClearAlpha=-1}setClearFlags(e,t,n){this.color=e,this.depth=t,this.stencil=n}getOverrideClearColor(){return this.overrideClearColor}setOverrideClearColor(e){this.overrideClearColor=e}getOverrideClearAlpha(){return this.overrideClearAlpha}setOverrideClearAlpha(e){this.overrideClearAlpha=e}render(e,t,n,r,i){let a=this.overrideClearColor,o=this.overrideClearAlpha,s=e.getClearAlpha(),c=a!==null,l=o>=0;c?(e.getClearColor(At),e.setClearColor(a,l?o:s)):l&&e.setClearAlpha(o),e.setRenderTarget(this.renderToScreen?null:t),e.clear(this.color,this.depth,this.stencil),c?e.setClearColor(At,s):l&&e.setClearAlpha(s)}},Mt=class extends B{constructor(e,t){super(`MaskPass`,e,t),this.needsSwap=!1,this.clearPass=new jt(!1,!1,!0),this.inverse=!1}set mainScene(e){this.scene=e}set mainCamera(e){this.camera=e}get inverted(){return this.inverse}set inverted(e){this.inverse=e}get clear(){return this.clearPass.enabled}set clear(e){this.clearPass.enabled=e}getClearPass(){return this.clearPass}isInverted(){return this.inverted}setInverted(e){this.inverted=e}render(e,t,n,r,i){let a=e.getContext(),o=e.state.buffers,s=this.scene,c=this.camera,l=this.clearPass,u=+!this.inverted,d=1-u;o.color.setMask(!1),o.depth.setMask(!1),o.color.setLocked(!0),o.depth.setLocked(!0),o.stencil.setTest(!0),o.stencil.setOp(a.REPLACE,a.REPLACE,a.REPLACE),o.stencil.setFunc(a.ALWAYS,u,4294967295),o.stencil.setClear(d),o.stencil.setLocked(!0),this.clearPass.enabled&&(this.renderToScreen?l.render(e,null):(l.render(e,t),l.render(e,n))),this.renderToScreen?(e.setRenderTarget(null),e.render(s,c)):(e.setRenderTarget(t),e.render(s,c),e.setRenderTarget(n),e.render(s,c)),o.color.setLocked(!1),o.depth.setLocked(!1),o.stencil.setLocked(!1),o.stencil.setFunc(a.EQUAL,1,4294967295),o.stencil.setOp(a.KEEP,a.KEEP,a.KEEP),o.stencil.setLocked(!0)}};function Nt(e,t){let n=e.getContext();if(t<=0||typeof n.renderbufferStorageMultisample!=`function`)return 0;let r=n.getParameter(n.MAX_SAMPLES),i=Math.min(t,r);if(i<=0)return 0;let a=n.getParameter(n.RENDERBUFFER_BINDING),o=n.createRenderbuffer();try{return n.bindRenderbuffer(n.RENDERBUFFER,o),n.renderbufferStorageMultisample(n.RENDERBUFFER,i,n.RGBA8,1,1),i}catch{return 0}finally{n.bindRenderbuffer(n.RENDERBUFFER,a),n.deleteRenderbuffer(o)}}var Pt=1/1e3,Ft=1e3,It=class{constructor(){this.startTime=performance.now(),this.previousTime=0,this.currentTime=0,this._delta=0,this._elapsed=0,this._fixedDelta=1e3/60,this.timescale=1,this.useFixedDelta=!1,this._autoReset=!1}get autoReset(){return this._autoReset}set autoReset(e){typeof document<`u`&&document.hidden!==void 0&&(e?document.addEventListener(`visibilitychange`,this):document.removeEventListener(`visibilitychange`,this),this._autoReset=e)}get delta(){return this._delta*Pt}get fixedDelta(){return this._fixedDelta*Pt}set fixedDelta(e){this._fixedDelta=e*Ft}get elapsed(){return this._elapsed*Pt}update(e){this.useFixedDelta?this._delta=this.fixedDelta:(this.previousTime=this.currentTime,this.currentTime=(e===void 0?performance.now():e)-this.startTime,this._delta=this.currentTime-this.previousTime),this._delta*=this.timescale,this._elapsed+=this._delta}reset(){this._delta=0,this._elapsed=0,this.currentTime=performance.now()-this.startTime}getDelta(){return this.delta}getElapsed(){return this.elapsed}handleEvent(e){document.hidden||(this.currentTime=performance.now()-this.startTime)}dispose(){this.autoReset=!1}},Lt=class{constructor(e=null,{depthBuffer:t=!0,stencilBuffer:n=!1,multisampling:r=0,frameBufferType:i=ke}={}){this.renderer=null,this.inputBuffer=this.createBuffer(t,n,i,r),this.outputBuffer=this.inputBuffer.clone(),this.copyPass=new kt,this.depthRenderTarget=null,this.passes=[],this.timer=new It,this.autoRenderToScreen=!0,this.setRenderer(e)}get stableDepthTexture(){return this.depthRenderTarget===null?null:this.depthRenderTarget.depthTexture}get multisampling(){return this.inputBuffer.samples}set multisampling(e){let t=this.renderer===null?e:Nt(this.renderer,e);this.multisampling!==t&&(this.inputBuffer.samples=t,this.outputBuffer.samples=t,this.inputBuffer.dispose(),this.outputBuffer.dispose())}getTimer(){return this.timer}getRenderer(){return this.renderer}setRenderer(e){if(this.renderer=e,e!==null){let t=e.getSize(new w),n=e.getContext().getContextAttributes().alpha,r=this.inputBuffer.texture.type;r===1009&&e.outputColorSpace===`srgb`&&(this.inputBuffer.texture.colorSpace=pe,this.outputBuffer.texture.colorSpace=pe,this.inputBuffer.dispose(),this.outputBuffer.dispose());let i=this.multisampling;this.multisampling=i,e.autoClear=!1,this.setSize(t.width,t.height);for(let t of this.passes)t.initialize(e,n,r)}}replaceRenderer(e,t=!0){let n=this.renderer,r=n.domElement.parentNode;return this.setRenderer(e),t&&r!==null&&(r.removeChild(n.domElement),r.appendChild(e.domElement)),n}createDepthTexture(){let e=new Ve;e.name=`EffectComposer.InputDepth`,this.inputBuffer.stencilBuffer?(e.format=me,e.type=Be):e.type=Ue;let t=new Ve;t.format=e.format,t.type=e.type,t.name=`EffectComposer.OutputDepth`;let n=new Ve;n.format=e.format,n.type=e.type,n.name=`EffectComposer.StableDepth`,this.inputBuffer.depthTexture=e,this.outputBuffer.depthTexture=t,this.inputBuffer.dispose(),this.outputBuffer.dispose();let{width:r,height:i}=this.inputBuffer;this.depthRenderTarget=new k(r,i,{depthBuffer:!0,stencilBuffer:this.inputBuffer.stencilBuffer,depthTexture:n})}blitDepthBuffer(e){let t=this.renderer,n=this.depthRenderTarget,r=t.properties,i=t.getContext();t.setRenderTarget(n);let a=r.get(e).__webglFramebuffer,o=r.get(n).__webglFramebuffer,s=e.stencilBuffer?i.DEPTH_BUFFER_BIT|i.STENCIL_BUFFER_BIT:i.DEPTH_BUFFER_BIT;i.bindFramebuffer(i.READ_FRAMEBUFFER,a),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,o),i.blitFramebuffer(0,0,e.width,e.height,0,0,n.width,n.height,s,i.NEAREST),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),t.setRenderTarget(null)}deleteDepthTexture(){let e=this.stableDepthTexture;for(let t of this.passes)t.getDepthTexture()===e&&t.setDepthTexture(null);this.depthRenderTarget!==null&&(this.depthRenderTarget.dispose(),this.depthRenderTarget=null),this.inputBuffer.depthTexture!==null&&(this.inputBuffer.depthTexture.dispose(),this.inputBuffer.depthTexture=null),this.outputBuffer.depthTexture!==null&&(this.outputBuffer.depthTexture.dispose(),this.outputBuffer.depthTexture=null)}createBuffer(e,t,n,r){let i=this.renderer,a=i===null?new w:i.getDrawingBufferSize(new w),o=new k(a.width,a.height,{minFilter:ie,magFilter:ie,samples:r,stencilBuffer:t,depthBuffer:e,type:n});return n===1009&&i!==null&&i.outputColorSpace===`srgb`&&(o.texture.colorSpace=pe),o.texture.name=`EffectComposer.Buffer`,o.texture.generateMipmaps=!1,o}setMainScene(e){for(let t of this.passes)t.mainScene=e}setMainCamera(e){for(let t of this.passes)t.mainCamera=e}addPass(e,t){let n=this.passes,r=this.renderer,i=r.getDrawingBufferSize(new w),a=r.getContext().getContextAttributes().alpha,o=this.inputBuffer.texture.type;if(e.renderer=r,e.setSize(i.width,i.height),e.initialize(r,a,o),this.autoRenderToScreen&&(n.length>0&&(n[n.length-1].renderToScreen=!1),e.renderToScreen&&(this.autoRenderToScreen=!1)),t===void 0?n.push(e):n.splice(t,0,e),this.autoRenderToScreen&&(n[n.length-1].renderToScreen=!0),e.needsDepthTexture||this.depthRenderTarget!==null){if(this.depthRenderTarget===null){this.createDepthTexture();for(let e of n)e.setDepthTexture(this.stableDepthTexture)}else e.setDepthTexture(this.stableDepthTexture)}}removePass(e){let t=this.passes,n=t.indexOf(e);if(n!==-1&&t.splice(n,1).length>0){let r=this.stableDepthTexture;r!==null&&(t.reduce((e,t)=>e||t.needsDepthTexture,!1)||(e.getDepthTexture()===r&&e.setDepthTexture(null),this.deleteDepthTexture())),this.autoRenderToScreen&&n===t.length&&(e.renderToScreen=!1,t.length>0&&(t[t.length-1].renderToScreen=!0))}}removeAllPasses(){let e=this.passes;this.deleteDepthTexture(),e.length>0&&(this.autoRenderToScreen&&(e[e.length-1].renderToScreen=!1),this.passes=[])}render(e){let t=this.renderer,n=this.copyPass,r=this.inputBuffer,i=this.outputBuffer,a,o=!1;e===void 0&&(this.timer.update(),e=this.timer.getDelta());for(let s of this.passes)if(s.enabled){if(s.render(t,r,i,e,o),s.needsDepthBlit&&this.depthRenderTarget!==null&&this.blitDepthBuffer(r),s.needsSwap){if(o){n.renderToScreen=s.renderToScreen;let a=t.getContext(),c=t.state.buffers.stencil;c.setFunc(a.NOTEQUAL,1,4294967295),n.render(t,r,i,e,o),c.setFunc(a.EQUAL,1,4294967295)}a=r,r=i,i=a}s instanceof Mt?o=!0:s instanceof Tt&&(o=!1)}}setSize(e,t,n){let r=this.renderer,i=r.getSize(new w);(e===void 0||t===void 0)&&(e=i.width,t=i.height),(i.width!==e||i.height!==t)&&r.setSize(e,t,n);let a=r.getDrawingBufferSize(new w);this.inputBuffer.setSize(a.width,a.height),this.outputBuffer.setSize(a.width,a.height),this.depthRenderTarget!==null&&this.depthRenderTarget.setSize(a.width,a.height);for(let e of this.passes)e.setSize(a.width,a.height)}reset(){this.dispose(),this.autoRenderToScreen=!0}dispose(){for(let e of this.passes)e.dispose();this.deleteDepthTexture(),this.inputBuffer.dispose(),this.outputBuffer.dispose(),this.copyPass.dispose(),this.timer.dispose(),this.passes=[],B.fullscreenGeometry.dispose()}},Rt={NONE:0,DEPTH:1,CONVOLUTION:2},V={FRAGMENT_HEAD:`FRAGMENT_HEAD`,FRAGMENT_MAIN_UV:`FRAGMENT_MAIN_UV`,FRAGMENT_MAIN_IMAGE:`FRAGMENT_MAIN_IMAGE`,VERTEX_HEAD:`VERTEX_HEAD`,VERTEX_MAIN_SUPPORT:`VERTEX_MAIN_SUPPORT`},zt=class{constructor(){this.shaderParts=new Map([[V.FRAGMENT_HEAD,null],[V.FRAGMENT_MAIN_UV,null],[V.FRAGMENT_MAIN_IMAGE,null],[V.VERTEX_HEAD,null],[V.VERTEX_MAIN_SUPPORT,null]]),this.defines=new Map,this.uniforms=new Map,this.blendModes=new Map,this.extensions=new Set,this.attributes=Rt.NONE,this.varyings=new Set,this.uvTransformation=!1,this.readDepth=!1,this.colorSpace=oe}},Bt=!1,Vt=class{constructor(e=null){this.originalMaterials=new Map,this.material=null,this.materials=null,this.materialsBackSide=null,this.materialsDoubleSide=null,this.materialsFlatShaded=null,this.materialsFlatShadedBackSide=null,this.materialsFlatShadedDoubleSide=null,this.setMaterial(e),this.meshCount=0,this.replaceMaterial=e=>{if(e.isMesh){let t;if(e.material.flatShading)switch(e.material.side){case 2:t=this.materialsFlatShadedDoubleSide;break;case 1:t=this.materialsFlatShadedBackSide;break;default:t=this.materialsFlatShaded}else switch(e.material.side){case 2:t=this.materialsDoubleSide;break;case 1:t=this.materialsBackSide;break;default:t=this.materials}this.originalMaterials.set(e,e.material),e.material=e.isSkinnedMesh?t[2]:e.isInstancedMesh?t[1]:t[0],++this.meshCount}}}cloneMaterial(e){if(!(e instanceof S))return e.clone();let t=e.uniforms,n=new Map;for(let e in t){let r=t[e].value;r.isRenderTargetTexture&&(t[e].value=null,n.set(e,r))}let r=e.clone();for(let e of n)t[e[0]].value=e[1],r.uniforms[e[0]].value=e[1];return r}setMaterial(e){if(this.disposeMaterials(),this.material=e,e!==null){let t=this.materials=[this.cloneMaterial(e),this.cloneMaterial(e),this.cloneMaterial(e)];for(let n of t)n.uniforms=Object.assign({},e.uniforms),n.side=0;t[2].skinning=!0,this.materialsBackSide=t.map(t=>{let n=this.cloneMaterial(t);return n.uniforms=Object.assign({},e.uniforms),n.side=1,n}),this.materialsDoubleSide=t.map(t=>{let n=this.cloneMaterial(t);return n.uniforms=Object.assign({},e.uniforms),n.side=2,n}),this.materialsFlatShaded=t.map(t=>{let n=this.cloneMaterial(t);return n.uniforms=Object.assign({},e.uniforms),n.flatShading=!0,n}),this.materialsFlatShadedBackSide=t.map(t=>{let n=this.cloneMaterial(t);return n.uniforms=Object.assign({},e.uniforms),n.flatShading=!0,n.side=1,n}),this.materialsFlatShadedDoubleSide=t.map(t=>{let n=this.cloneMaterial(t);return n.uniforms=Object.assign({},e.uniforms),n.flatShading=!0,n.side=2,n})}}render(e,t,n){let r=e.shadowMap.enabled;if(e.shadowMap.enabled=!1,Bt){let r=this.originalMaterials;this.meshCount=0,t.traverse(this.replaceMaterial),e.render(t,n);for(let e of r)e[0].material=e[1];this.meshCount!==r.size&&r.clear()}else{let r=t.overrideMaterial;t.overrideMaterial=this.material,e.render(t,n),t.overrideMaterial=r}e.shadowMap.enabled=r}disposeMaterials(){if(this.material!==null){let e=this.materials.concat(this.materialsBackSide).concat(this.materialsDoubleSide).concat(this.materialsFlatShaded).concat(this.materialsFlatShadedBackSide).concat(this.materialsFlatShadedDoubleSide);for(let t of e)t.dispose()}}dispose(){this.originalMaterials.clear(),this.disposeMaterials()}static get workaroundEnabled(){return Bt}static set workaroundEnabled(e){Bt=e}},Ht=-1,H=class extends We{constructor(e=null,t=Ht,n=Ht,r=1){super(),e!==null&&this.addEventListener(`change`,()=>e.setSize(this.baseSize.width,this.baseSize.height)),this.baseSize=new w(1,1),this.preferredSize=new w(t,n),this.target=this.preferredSize,this.s=r,this.effectiveSize=new w,this.addEventListener(`change`,()=>this.updateEffectiveSize()),this.updateEffectiveSize()}updateEffectiveSize(){let e=this.baseSize,t=this.preferredSize,n=this.effectiveSize,r=this.scale;n.width=t.width===Ht?t.height===Ht?Math.round(e.width*r):Math.round(t.height*(e.width/Math.max(e.height,1))):t.width,n.height=t.height===Ht?t.width===Ht?Math.round(e.height*r):Math.round(t.width/Math.max(e.width/Math.max(e.height,1),1)):t.height}get width(){return this.effectiveSize.width}set width(e){this.preferredWidth=e}get height(){return this.effectiveSize.height}set height(e){this.preferredHeight=e}getWidth(){return this.width}getHeight(){return this.height}get scale(){return this.s}set scale(e){this.s!==e&&(this.s=e,this.preferredSize.setScalar(Ht),this.dispatchEvent({type:`change`}))}getScale(){return this.scale}setScale(e){this.scale=e}get baseWidth(){return this.baseSize.width}set baseWidth(e){this.baseSize.width!==e&&(this.baseSize.width=e,this.dispatchEvent({type:`change`}))}getBaseWidth(){return this.baseWidth}setBaseWidth(e){this.baseWidth=e}get baseHeight(){return this.baseSize.height}set baseHeight(e){this.baseSize.height!==e&&(this.baseSize.height=e,this.dispatchEvent({type:`change`}))}getBaseHeight(){return this.baseHeight}setBaseHeight(e){this.baseHeight=e}setBaseSize(e,t){(this.baseSize.width!==e||this.baseSize.height!==t)&&(this.baseSize.set(e,t),this.dispatchEvent({type:`change`}))}get preferredWidth(){return this.preferredSize.width}set preferredWidth(e){this.preferredSize.width!==e&&(this.preferredSize.width=e,this.dispatchEvent({type:`change`}))}getPreferredWidth(){return this.preferredWidth}setPreferredWidth(e){this.preferredWidth=e}get preferredHeight(){return this.preferredSize.height}set preferredHeight(e){this.preferredSize.height!==e&&(this.preferredSize.height=e,this.dispatchEvent({type:`change`}))}getPreferredHeight(){return this.preferredHeight}setPreferredHeight(e){this.preferredHeight=e}setPreferredSize(e,t){(this.preferredSize.width!==e||this.preferredSize.height!==t)&&(this.preferredSize.set(e,t),this.dispatchEvent({type:`change`}))}copy(e){this.s=e.scale,this.baseSize.set(e.baseWidth,e.baseHeight),this.preferredSize.set(e.preferredWidth,e.preferredHeight),this.dispatchEvent({type:`change`})}static get AUTO_SIZE(){return Ht}},U={SKIP:9,SET:30,ADD:0,ALPHA:1,AVERAGE:2,COLOR:3,COLOR_BURN:4,COLOR_DODGE:5,DARKEN:6,DIFFERENCE:7,DIVIDE:8,DST:9,EXCLUSION:10,HARD_LIGHT:11,HARD_MIX:12,HUE:13,INVERT:14,INVERT_RGB:15,LIGHTEN:16,LINEAR_BURN:17,LINEAR_DODGE:18,LINEAR_LIGHT:19,LUMINOSITY:20,MULTIPLY:21,NEGATION:22,NORMAL:23,OVERLAY:24,PIN_LIGHT:25,REFLECT:26,SATURATION:27,SCREEN:28,SOFT_LIGHT:29,SRC:30,SUBTRACT:31,VIVID_LIGHT:32},Ut=new Map([[U.ADD,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb+src.rgb;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.ALPHA,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){return mix(dst,src,src.a*opacity);}`],[U.AVERAGE,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=(dst.rgb+src.rgb)*0.5;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.COLOR,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(b.xy,a.z));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.COLOR_BURN,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=dst.rgb,b=src.rgb;vec3 c=mix(step(0.0,b)*(1.0-min(vec3(1.0),(1.0-a)/max(b,1e-9))),vec3(1.0),step(1.0,a));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.COLOR_DODGE,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=dst.rgb,b=src.rgb;vec3 c=step(0.0,a)*mix(min(vec3(1.0),a/max(1.0-b,1e-9)),vec3(1.0),step(1.0,b));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.DARKEN,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=min(dst.rgb,src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.DIFFERENCE,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=abs(dst.rgb-src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.DIVIDE,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb/max(src.rgb,1e-9);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.DST,null],[U.EXCLUSION,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb+src.rgb-2.0*dst.rgb*src.rgb;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.HARD_LIGHT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=min(dst.rgb,1.0);vec3 b=min(src.rgb,1.0);vec3 c=mix(2.0*a*b,1.0-2.0*(1.0-a)*(1.0-b),step(0.5,b));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.HARD_MIX,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=step(1.0,dst.rgb+src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.HUE,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(b.x,a.yz));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.INVERT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(1.0-src.rgb,0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.INVERT_RGB,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=src.rgb*max(1.0-dst.rgb,0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.LIGHTEN,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(dst.rgb,src.rgb);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.LINEAR_BURN,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=clamp(src.rgb+dst.rgb-1.0,0.0,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.LINEAR_DODGE,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=min(dst.rgb+src.rgb,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.LINEAR_LIGHT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=clamp(2.0*src.rgb+dst.rgb-1.0,0.0,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.LUMINOSITY,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(a.xy,b.z));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.MULTIPLY,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb*src.rgb;return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.NEGATION,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(1.0-abs(1.0-dst.rgb-src.rgb),0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.NORMAL,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){return mix(dst,src,opacity);}`],[U.OVERLAY,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=2.0*src.rgb*dst.rgb;vec3 b=1.0-2.0*(1.0-src.rgb)*(1.0-dst.rgb);vec3 c=mix(a,b,step(0.5,dst.rgb));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.PIN_LIGHT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 src2=2.0*src.rgb;vec3 c=mix(mix(src2,dst.rgb,step(0.5*dst.rgb,src.rgb)),max(src2-1.0,vec3(0.0)),step(dst.rgb,src2-1.0));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.REFLECT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=min(dst.rgb*dst.rgb/max(1.0-src.rgb,1e-9),1.0);vec3 c=mix(a,src.rgb,step(1.0,src.rgb));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.SATURATION,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 a=RGBToHSL(dst.rgb);vec3 b=RGBToHSL(src.rgb);vec3 c=HSLToRGB(vec3(a.x,b.y,a.z));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.SCREEN,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=dst.rgb+src.rgb-min(dst.rgb*src.rgb,1.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.SOFT_LIGHT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 src2=2.0*src.rgb;vec3 d=dst.rgb+(src2-1.0);vec3 w=step(0.5,src.rgb);vec3 a=dst.rgb-(1.0-src2)*dst.rgb*(1.0-dst.rgb);vec3 b=mix(d*(sqrt(dst.rgb)-dst.rgb),d*dst.rgb*((16.0*dst.rgb-12.0)*dst.rgb+3.0),w*(1.0-step(0.25,dst.rgb)));vec3 c=mix(a,b,w);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.SRC,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){return src;}`],[U.SUBTRACT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=max(dst.rgb-src.rgb,0.0);return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`],[U.VIVID_LIGHT,`vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){vec3 c=mix(max(1.0-min((1.0-dst.rgb)/(2.0*src.rgb),1.0),0.0),min(dst.rgb/(2.0*(1.0-src.rgb)),1.0),step(0.5,src.rgb));return mix(dst,vec4(c,max(dst.a,src.a)),opacity);}`]]),Wt=class extends We{constructor(e,t=1){super(),this._blendFunction=e,this.opacity=new A(t)}getOpacity(){return this.opacity.value}setOpacity(e){this.opacity.value=e}get blendFunction(){return this._blendFunction}set blendFunction(e){this._blendFunction=e,this.dispatchEvent({type:`change`})}getBlendFunction(){return this.blendFunction}setBlendFunction(e){this.blendFunction=e}getShaderCode(){return Ut.get(this.blendFunction)}},Gt=class extends We{constructor(e,t,{attributes:n=Rt.NONE,blendFunction:r=U.NORMAL,defines:i=new Map,uniforms:a=new Map,extensions:o=null,vertexShader:s=null}={}){super(),this.name=e,this.renderer=null,this.attributes=n,this.fragmentShader=t,this.vertexShader=s,this.defines=i,this.uniforms=a,this.extensions=o,this.blendMode=new Wt(r),this.blendMode.addEventListener(`change`,e=>this.setChanged()),this._inputColorSpace=oe,this._outputColorSpace=``}get inputColorSpace(){return this._inputColorSpace}set inputColorSpace(e){this._inputColorSpace=e,this.setChanged()}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e,this.setChanged()}set mainScene(e){}set mainCamera(e){}getName(){return this.name}setRenderer(e){this.renderer=e}getDefines(){return this.defines}getUniforms(){return this.uniforms}getExtensions(){return this.extensions}getBlendMode(){return this.blendMode}getAttributes(){return this.attributes}setAttributes(e){this.attributes=e,this.setChanged()}getFragmentShader(){return this.fragmentShader}setFragmentShader(e){this.fragmentShader=e,this.setChanged()}getVertexShader(){return this.vertexShader}setVertexShader(e){this.vertexShader=e,this.setChanged()}setChanged(){this.dispatchEvent({type:`change`})}setDepthTexture(e,t=Ie){}update(e,t,n){}setSize(e,t){}initialize(e,t,n){}dispose(){for(let e of Object.keys(this)){let t=this[e];(t instanceof k||t instanceof v||t instanceof Te||t instanceof B)&&this[e].dispose()}}},Kt={VERY_SMALL:0,SMALL:1,MEDIUM:2,LARGE:3,VERY_LARGE:4,HUGE:5},qt=`#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;varying vec2 vUv3;void main(){vec4 sum=texture2D(inputBuffer,vUv0);sum+=texture2D(inputBuffer,vUv1);sum+=texture2D(inputBuffer,vUv2);sum+=texture2D(inputBuffer,vUv3);gl_FragColor=sum*0.25;
#include <colorspace_fragment>
}`,Jt=`uniform vec4 texelSize;uniform float kernel;uniform float scale;varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;varying vec2 vUv3;void main(){vec2 uv=position.xy*0.5+0.5;vec2 dUv=(texelSize.xy*vec2(kernel)+texelSize.zw)*scale;vUv0=vec2(uv.x-dUv.x,uv.y+dUv.y);vUv1=vec2(uv.x+dUv.x,uv.y+dUv.y);vUv2=vec2(uv.x+dUv.x,uv.y-dUv.y);vUv3=vec2(uv.x-dUv.x,uv.y-dUv.y);gl_Position=vec4(position.xy,1.0,1.0);}`,Yt=[new Float32Array([0,0]),new Float32Array([0,1,1]),new Float32Array([0,1,1,2]),new Float32Array([0,1,2,2,3]),new Float32Array([0,1,2,3,4,4,5]),new Float32Array([0,1,2,3,4,5,7,8,9,10])],Xt=class extends S{constructor(e=new Pe){super({name:`KawaseBlurMaterial`,uniforms:{inputBuffer:new A(null),texelSize:new A(new Pe),scale:new A(1),kernel:new A(0)},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:qt,vertexShader:Jt}),this.setTexelSize(e.x,e.y),this.kernelSize=Kt.MEDIUM}set inputBuffer(e){this.uniforms.inputBuffer.value=e}setInputBuffer(e){this.inputBuffer=e}get kernelSequence(){return Yt[this.kernelSize]}get scale(){return this.uniforms.scale.value}set scale(e){this.uniforms.scale.value=e}getScale(){return this.uniforms.scale.value}setScale(e){this.uniforms.scale.value=e}getKernel(){return null}get kernel(){return this.uniforms.kernel.value}set kernel(e){this.uniforms.kernel.value=e}setKernel(e){this.kernel=e}setTexelSize(e,t){this.uniforms.texelSize.value.set(e,t,e*.5,t*.5)}setSize(e,t){let n=1/e,r=1/t;this.uniforms.texelSize.value.set(n,r,n*.5,r*.5)}},Zt=class extends B{constructor({kernelSize:e=Kt.MEDIUM,resolutionScale:t=.5,width:n=H.AUTO_SIZE,height:r=H.AUTO_SIZE,resolutionX:i=n,resolutionY:a=r}={}){super(`KawaseBlurPass`),this.renderTargetA=new k(1,1,{depthBuffer:!1}),this.renderTargetA.texture.name=`Blur.Target.A`,this.renderTargetB=this.renderTargetA.clone(),this.renderTargetB.texture.name=`Blur.Target.B`;let o=this.resolution=new H(this,i,a,t);o.addEventListener(`change`,e=>this.setSize(o.baseWidth,o.baseHeight)),this._blurMaterial=new Xt,this._blurMaterial.kernelSize=e,this.copyMaterial=new Ot}getResolution(){return this.resolution}get blurMaterial(){return this._blurMaterial}set blurMaterial(e){this._blurMaterial=e}get dithering(){return this.copyMaterial.dithering}set dithering(e){this.copyMaterial.dithering=e}get kernelSize(){return this.blurMaterial.kernelSize}set kernelSize(e){this.blurMaterial.kernelSize=e}get width(){return this.resolution.width}set width(e){this.resolution.preferredWidth=e}get height(){return this.resolution.height}set height(e){this.resolution.preferredHeight=e}get scale(){return this.blurMaterial.scale}set scale(e){this.blurMaterial.scale=e}getScale(){return this.blurMaterial.scale}setScale(e){this.blurMaterial.scale=e}getKernelSize(){return this.kernelSize}setKernelSize(e){this.kernelSize=e}getResolutionScale(){return this.resolution.scale}setResolutionScale(e){this.resolution.scale=e}render(e,t,n,r,i){let a=this.scene,o=this.camera,s=this.renderTargetA,c=this.renderTargetB,l=this.blurMaterial,u=l.kernelSequence,d=t;this.fullscreenMaterial=l;for(let t=0,n=u.length;t<n;++t){let n=t&1?c:s;l.kernel=u[t],l.inputBuffer=d.texture,e.setRenderTarget(n),e.render(a,o),d=n}this.fullscreenMaterial=this.copyMaterial,this.copyMaterial.inputBuffer=d.texture,e.setRenderTarget(this.renderToScreen?null:n),e.render(a,o)}setSize(e,t){let n=this.resolution;n.setBaseSize(e,t);let r=n.width,i=n.height;this.renderTargetA.setSize(r,i),this.renderTargetB.setSize(r,i),this.blurMaterial.setSize(e,t)}initialize(e,t,n){n!==void 0&&(this.renderTargetA.texture.type=n,this.renderTargetB.texture.type=n,n===1009?e!==null&&e.outputColorSpace===`srgb`&&(this.renderTargetA.texture.colorSpace=pe,this.renderTargetB.texture.colorSpace=pe):(this.blurMaterial.defines.FRAMEBUFFER_PRECISION_HIGH=`1`,this.copyMaterial.defines.FRAMEBUFFER_PRECISION_HIGH=`1`))}static get AUTO_SIZE(){return H.AUTO_SIZE}},Qt=`#include <common>
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#ifdef RANGE
uniform vec2 range;
#elif defined(THRESHOLD)
uniform float threshold;uniform float smoothing;
#endif
varying vec2 vUv;void main(){vec4 texel=texture2D(inputBuffer,vUv);float l=luminance(texel.rgb);float mask=1.0;
#ifdef RANGE
float low=step(range.x,l);float high=step(l,range.y);mask=low*high;
#elif defined(THRESHOLD)
mask=smoothstep(threshold,threshold+smoothing,l);
#endif
#ifdef COLOR
gl_FragColor=texel*mask;
#else
gl_FragColor=vec4(l*mask);
#endif
}`,$t=class extends S{constructor(e=!1,t=null){super({name:`LuminanceMaterial`,defines:{THREE_REVISION:`186`.replace(/\D+/g,``)},uniforms:{inputBuffer:new A(null),threshold:new A(0),smoothing:new A(1),range:new A(null)},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:Qt,vertexShader:Dt}),this.colorOutput=e,this.luminanceRange=t}set inputBuffer(e){this.uniforms.inputBuffer.value=e}setInputBuffer(e){this.uniforms.inputBuffer.value=e}get threshold(){return this.uniforms.threshold.value}set threshold(e){this.smoothing>0||e>0?this.defines.THRESHOLD=`1`:delete this.defines.THRESHOLD,this.uniforms.threshold.value=e}getThreshold(){return this.threshold}setThreshold(e){this.threshold=e}get smoothing(){return this.uniforms.smoothing.value}set smoothing(e){this.threshold>0||e>0?this.defines.THRESHOLD=`1`:delete this.defines.THRESHOLD,this.uniforms.smoothing.value=e}getSmoothingFactor(){return this.smoothing}setSmoothingFactor(e){this.smoothing=e}get useThreshold(){return this.threshold>0||this.smoothing>0}set useThreshold(e){}get colorOutput(){return this.defines.COLOR!==void 0}set colorOutput(e){e?this.defines.COLOR=`1`:delete this.defines.COLOR,this.needsUpdate=!0}isColorOutputEnabled(e){return this.colorOutput}setColorOutputEnabled(e){this.colorOutput=e}get useRange(){return this.luminanceRange!==null}set useRange(e){this.luminanceRange=null}get luminanceRange(){return this.uniforms.range.value}set luminanceRange(e){e===null?delete this.defines.RANGE:this.defines.RANGE=`1`,this.uniforms.range.value=e,this.needsUpdate=!0}getLuminanceRange(){return this.luminanceRange}setLuminanceRange(e){this.luminanceRange=e}},en=class extends B{constructor({renderTarget:e,luminanceRange:t,colorOutput:n,resolutionScale:r=1,width:i=H.AUTO_SIZE,height:a=H.AUTO_SIZE,resolutionX:o=i,resolutionY:s=a}={}){super(`LuminancePass`),this.fullscreenMaterial=new $t(n,t),this.needsSwap=!1,this.renderTarget=e,this.renderTarget===void 0&&(this.renderTarget=new k(1,1,{depthBuffer:!1}),this.renderTarget.texture.name=`LuminancePass.Target`);let c=this.resolution=new H(this,o,s,r);c.addEventListener(`change`,e=>this.setSize(c.baseWidth,c.baseHeight))}get texture(){return this.renderTarget.texture}getTexture(){return this.renderTarget.texture}getResolution(){return this.resolution}render(e,t,n,r,i){let a=this.fullscreenMaterial;a.inputBuffer=t.texture,e.setRenderTarget(this.renderToScreen?null:this.renderTarget),e.render(this.scene,this.camera)}setSize(e,t){let n=this.resolution;n.setBaseSize(e,t),this.renderTarget.setSize(n.width,n.height)}initialize(e,t,n){n!==void 0&&n!==1009&&(this.renderTarget.texture.type=n,this.fullscreenMaterial.defines.FRAMEBUFFER_PRECISION_HIGH=`1`)}},tn=`#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#define WEIGHT_INNER 0.125
#define WEIGHT_OUTER 0.05556
varying vec2 vUv;varying vec2 vUv00;varying vec2 vUv01;varying vec2 vUv02;varying vec2 vUv03;varying vec2 vUv04;varying vec2 vUv05;varying vec2 vUv06;varying vec2 vUv07;varying vec2 vUv08;varying vec2 vUv09;varying vec2 vUv10;varying vec2 vUv11;float clampToBorder(const in vec2 uv){return float(uv.s>=0.0&&uv.s<=1.0&&uv.t>=0.0&&uv.t<=1.0);}void main(){vec4 c=vec4(0.0);vec4 w=WEIGHT_INNER*vec4(clampToBorder(vUv00),clampToBorder(vUv01),clampToBorder(vUv02),clampToBorder(vUv03));c+=w.x*texture2D(inputBuffer,vUv00);c+=w.y*texture2D(inputBuffer,vUv01);c+=w.z*texture2D(inputBuffer,vUv02);c+=w.w*texture2D(inputBuffer,vUv03);w=WEIGHT_OUTER*vec4(clampToBorder(vUv04),clampToBorder(vUv05),clampToBorder(vUv06),clampToBorder(vUv07));c+=w.x*texture2D(inputBuffer,vUv04);c+=w.y*texture2D(inputBuffer,vUv05);c+=w.z*texture2D(inputBuffer,vUv06);c+=w.w*texture2D(inputBuffer,vUv07);w=WEIGHT_OUTER*vec4(clampToBorder(vUv08),clampToBorder(vUv09),clampToBorder(vUv10),clampToBorder(vUv11));c+=w.x*texture2D(inputBuffer,vUv08);c+=w.y*texture2D(inputBuffer,vUv09);c+=w.z*texture2D(inputBuffer,vUv10);c+=w.w*texture2D(inputBuffer,vUv11);c+=WEIGHT_OUTER*texture2D(inputBuffer,vUv);gl_FragColor=c;
#include <colorspace_fragment>
}`,nn=`uniform vec2 texelSize;varying vec2 vUv;varying vec2 vUv00;varying vec2 vUv01;varying vec2 vUv02;varying vec2 vUv03;varying vec2 vUv04;varying vec2 vUv05;varying vec2 vUv06;varying vec2 vUv07;varying vec2 vUv08;varying vec2 vUv09;varying vec2 vUv10;varying vec2 vUv11;void main(){vUv=position.xy*0.5+0.5;vUv00=vUv+texelSize*vec2(-1.0,1.0);vUv01=vUv+texelSize*vec2(1.0,1.0);vUv02=vUv+texelSize*vec2(-1.0,-1.0);vUv03=vUv+texelSize*vec2(1.0,-1.0);vUv04=vUv+texelSize*vec2(-2.0,2.0);vUv05=vUv+texelSize*vec2(0.0,2.0);vUv06=vUv+texelSize*vec2(2.0,2.0);vUv07=vUv+texelSize*vec2(-2.0,0.0);vUv08=vUv+texelSize*vec2(2.0,0.0);vUv09=vUv+texelSize*vec2(-2.0,-2.0);vUv10=vUv+texelSize*vec2(0.0,-2.0);vUv11=vUv+texelSize*vec2(2.0,-2.0);gl_Position=vec4(position.xy,1.0,1.0);}`,rn=class extends S{constructor(){super({name:`DownsamplingMaterial`,uniforms:{inputBuffer:new A(null),texelSize:new A(new w)},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:tn,vertexShader:nn})}set inputBuffer(e){this.uniforms.inputBuffer.value=e}setSize(e,t){this.uniforms.texelSize.value.set(1/e,1/t)}},an=`#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;uniform mediump sampler2D supportBuffer;
#else
uniform lowp sampler2D inputBuffer;uniform lowp sampler2D supportBuffer;
#endif
uniform float radius;varying vec2 vUv;varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;varying vec2 vUv3;varying vec2 vUv4;varying vec2 vUv5;varying vec2 vUv6;varying vec2 vUv7;void main(){vec4 c=vec4(0.0);c+=texture2D(inputBuffer,vUv0)*0.0625;c+=texture2D(inputBuffer,vUv1)*0.125;c+=texture2D(inputBuffer,vUv2)*0.0625;c+=texture2D(inputBuffer,vUv3)*0.125;c+=texture2D(inputBuffer,vUv)*0.25;c+=texture2D(inputBuffer,vUv4)*0.125;c+=texture2D(inputBuffer,vUv5)*0.0625;c+=texture2D(inputBuffer,vUv6)*0.125;c+=texture2D(inputBuffer,vUv7)*0.0625;vec4 baseColor=texture2D(supportBuffer,vUv);gl_FragColor=mix(baseColor,c,radius);
#include <colorspace_fragment>
}`,on=`uniform vec2 texelSize;varying vec2 vUv;varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;varying vec2 vUv3;varying vec2 vUv4;varying vec2 vUv5;varying vec2 vUv6;varying vec2 vUv7;void main(){vUv=position.xy*0.5+0.5;vUv0=vUv+texelSize*vec2(-1.0,1.0);vUv1=vUv+texelSize*vec2(0.0,1.0);vUv2=vUv+texelSize*vec2(1.0,1.0);vUv3=vUv+texelSize*vec2(-1.0,0.0);vUv4=vUv+texelSize*vec2(1.0,0.0);vUv5=vUv+texelSize*vec2(-1.0,-1.0);vUv6=vUv+texelSize*vec2(0.0,-1.0);vUv7=vUv+texelSize*vec2(1.0,-1.0);gl_Position=vec4(position.xy,1.0,1.0);}`,sn=class extends S{constructor(){super({name:`UpsamplingMaterial`,uniforms:{inputBuffer:new A(null),supportBuffer:new A(null),texelSize:new A(new w),radius:new A(.85)},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:an,vertexShader:on})}set inputBuffer(e){this.uniforms.inputBuffer.value=e}set supportBuffer(e){this.uniforms.supportBuffer.value=e}get radius(){return this.uniforms.radius.value}set radius(e){this.uniforms.radius.value=e}setSize(e,t){this.uniforms.texelSize.value.set(1/e,1/t)}},cn=class extends B{constructor(){super(`MipmapBlurPass`),this.needsSwap=!1,this.renderTarget=new k(1,1,{depthBuffer:!1}),this.renderTarget.texture.name=`Upsampling.Mipmap0`,this.downsamplingMipmaps=[],this.upsamplingMipmaps=[],this.downsamplingMaterial=new rn,this.upsamplingMaterial=new sn,this.resolution=new w}get texture(){return this.renderTarget.texture}get levels(){return this.downsamplingMipmaps.length}set levels(e){if(this.levels!==e){let t=this.renderTarget;this.dispose(),this.downsamplingMipmaps=[],this.upsamplingMipmaps=[];for(let n=0;n<e;++n){let e=t.clone();e.texture.name=`Downsampling.Mipmap`+n,this.downsamplingMipmaps.push(e)}this.upsamplingMipmaps.push(t);for(let n=1,r=e-1;n<r;++n){let e=t.clone();e.texture.name=`Upsampling.Mipmap`+n,this.upsamplingMipmaps.push(e)}this.setSize(this.resolution.x,this.resolution.y)}}get radius(){return this.upsamplingMaterial.radius}set radius(e){this.upsamplingMaterial.radius=e}render(e,t,n,r,i){let{scene:a,camera:o}=this,{downsamplingMaterial:s,upsamplingMaterial:c}=this,{downsamplingMipmaps:l,upsamplingMipmaps:u}=this,d=t;this.fullscreenMaterial=s;for(let t=0,n=l.length;t<n;++t){let n=l[t];s.setSize(d.width,d.height),s.inputBuffer=d.texture,e.setRenderTarget(n),e.render(a,o),d=n}this.fullscreenMaterial=c;for(let t=u.length-1;t>=0;--t){let n=u[t];c.setSize(d.width,d.height),c.inputBuffer=d.texture,c.supportBuffer=l[t].texture,e.setRenderTarget(n),e.render(a,o),d=n}}setSize(e,t){let n=this.resolution;n.set(e,t);let r=n.width,i=n.height;for(let e=0,t=this.downsamplingMipmaps.length;e<t;++e)r=Math.round(r*.5),i=Math.round(i*.5),this.downsamplingMipmaps[e].setSize(r,i),e<this.upsamplingMipmaps.length&&this.upsamplingMipmaps[e].setSize(r,i)}initialize(e,t,n){if(n!==void 0){let t=this.downsamplingMipmaps.concat(this.upsamplingMipmaps);for(let e of t)e.texture.type=n;if(n!==1009)this.downsamplingMaterial.defines.FRAMEBUFFER_PRECISION_HIGH=`1`,this.upsamplingMaterial.defines.FRAMEBUFFER_PRECISION_HIGH=`1`;else if(e!==null&&e.outputColorSpace===`srgb`)for(let e of t)e.texture.colorSpace=pe}}dispose(){super.dispose();for(let e of this.downsamplingMipmaps.concat(this.upsamplingMipmaps))e.dispose()}},ln=`#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D map;
#else
uniform lowp sampler2D map;
#endif
uniform float intensity;void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){outputColor=texture2D(map,uv)*intensity;}`,un=class extends Gt{constructor({blendFunction:e=U.SCREEN,luminanceThreshold:t=1,luminanceSmoothing:n=.03,mipmapBlur:r=!0,intensity:i=1,radius:a=.85,levels:o=8,kernelSize:s=Kt.LARGE,resolutionScale:c=.5,width:l=H.AUTO_SIZE,height:u=H.AUTO_SIZE,resolutionX:d=l,resolutionY:f=u}={}){super(`BloomEffect`,ln,{blendFunction:e,uniforms:new Map([[`map`,new A(null)],[`intensity`,new A(i)]])}),this.renderTarget=new k(1,1,{depthBuffer:!1}),this.renderTarget.texture.name=`Bloom.Target`,this.blurPass=new Zt({kernelSize:s}),this.luminancePass=new en({colorOutput:!0}),this.luminanceMaterial.threshold=t,this.luminanceMaterial.smoothing=n,this.mipmapBlurPass=new cn,this.mipmapBlurPass.enabled=r,this.mipmapBlurPass.radius=a,this.mipmapBlurPass.levels=o,this.uniforms.get(`map`).value=r?this.mipmapBlurPass.texture:this.renderTarget.texture;let p=this.resolution=new H(this,d,f,c);p.addEventListener(`change`,e=>this.setSize(p.baseWidth,p.baseHeight))}get texture(){return this.mipmapBlurPass.enabled?this.mipmapBlurPass.texture:this.renderTarget.texture}getTexture(){return this.texture}getResolution(){return this.resolution}getBlurPass(){return this.blurPass}getLuminancePass(){return this.luminancePass}get luminanceMaterial(){return this.luminancePass.fullscreenMaterial}getLuminanceMaterial(){return this.luminancePass.fullscreenMaterial}get width(){return this.resolution.width}set width(e){this.resolution.preferredWidth=e}get height(){return this.resolution.height}set height(e){this.resolution.preferredHeight=e}get dithering(){return this.blurPass.dithering}set dithering(e){this.blurPass.dithering=e}get kernelSize(){return this.blurPass.kernelSize}set kernelSize(e){this.blurPass.kernelSize=e}get distinction(){return console.warn(this.name,`distinction was removed`),1}set distinction(e){console.warn(this.name,`distinction was removed`)}get intensity(){return this.uniforms.get(`intensity`).value}set intensity(e){this.uniforms.get(`intensity`).value=e}getIntensity(){return this.intensity}setIntensity(e){this.intensity=e}getResolutionScale(){return this.resolution.scale}setResolutionScale(e){this.resolution.scale=e}update(e,t,n){let r=this.renderTarget,i=this.luminancePass;i.enabled?(i.render(e,t),this.mipmapBlurPass.enabled?this.mipmapBlurPass.render(e,i.renderTarget):this.blurPass.render(e,i.renderTarget,r)):this.mipmapBlurPass.enabled?this.mipmapBlurPass.render(e,t):this.blurPass.render(e,t,r)}setSize(e,t){let n=this.resolution;n.setBaseSize(e,t),this.renderTarget.setSize(n.width,n.height),this.blurPass.resolution.copy(n),this.luminancePass.setSize(e,t),this.mipmapBlurPass.setSize(e,t)}initialize(e,t,n){this.blurPass.initialize(e,t,n),this.luminancePass.initialize(e,t,n),this.mipmapBlurPass.initialize(e,t,n),n!==void 0&&(this.renderTarget.texture.type=n,e!==null&&e.outputColorSpace===`srgb`&&(this.renderTarget.texture.colorSpace=pe))}},dn=class extends B{constructor(e,t,n=null){super(`RenderPass`,e,t),this.needsSwap=!1,this.needsDepthBlit=!0,this.clearPass=new jt,this.overrideMaterialManager=n===null?null:new Vt(n),this.ignoreBackground=!1,this.skipShadowMapUpdate=!1,this.selection=null}set mainScene(e){this.scene=e}set mainCamera(e){this.camera=e}get renderToScreen(){return super.renderToScreen}set renderToScreen(e){super.renderToScreen=e,this.clearPass.renderToScreen=e}get overrideMaterial(){let e=this.overrideMaterialManager;return e===null?null:e.material}set overrideMaterial(e){let t=this.overrideMaterialManager;e===null?t!==null&&(t.dispose(),this.overrideMaterialManager=null):t===null?this.overrideMaterialManager=new Vt(e):t.setMaterial(e)}getOverrideMaterial(){return this.overrideMaterial}setOverrideMaterial(e){this.overrideMaterial=e}get clear(){return this.clearPass.enabled}set clear(e){this.clearPass.enabled=e}getSelection(){return this.selection}setSelection(e){this.selection=e}isBackgroundDisabled(){return this.ignoreBackground}setBackgroundDisabled(e){this.ignoreBackground=e}isShadowMapDisabled(){return this.skipShadowMapUpdate}setShadowMapDisabled(e){this.skipShadowMapUpdate=e}getClearPass(){return this.clearPass}render(e,t,n,r,i){let a=this.scene,o=this.camera,s=this.selection,c=o.layers.mask,l=a.background,u=e.shadowMap.autoUpdate,d=this.renderToScreen?null:t;s!==null&&o.layers.set(s.getLayer()),this.skipShadowMapUpdate&&(e.shadowMap.autoUpdate=!1),(this.ignoreBackground||this.clearPass.overrideClearColor!==null)&&(a.background=null),this.clearPass.enabled&&this.clearPass.render(e,t),e.setRenderTarget(d),this.overrideMaterialManager===null?e.render(a,o):this.overrideMaterialManager.render(e,a,o),o.layers.mask=c,a.background=l,e.shadowMap.autoUpdate=u}},W={LINEAR:0,REINHARD:1,REINHARD2:2,REINHARD2_ADAPTIVE:3,UNCHARTED2:4,OPTIMIZED_CINEON:5,CINEON:5,ACES_FILMIC:6,AGX:7,NEUTRAL:8},fn={DEFAULT:0,ESKIL:1},pn=`#include <packing>
#ifdef GL_FRAGMENT_PRECISION_HIGH
uniform highp sampler2D depthBuffer;
#else
uniform mediump sampler2D depthBuffer;
#endif
#ifdef DOWNSAMPLE_NORMALS
uniform lowp sampler2D normalBuffer;
#endif
varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;varying vec2 vUv3;float readDepth(const in vec2 uv){
#if DEPTH_PACKING == 3201
return unpackRGBAToDepth(texture2D(depthBuffer,uv));
#else
return texture2D(depthBuffer,uv).r;
#endif
}int findBestDepth(const in float samples[4]){float c=(samples[0]+samples[1]+samples[2]+samples[3])*0.25;float distances[4];distances[0]=abs(c-samples[0]);distances[1]=abs(c-samples[1]);distances[2]=abs(c-samples[2]);distances[3]=abs(c-samples[3]);float maxDistance=max(max(distances[0],distances[1]),max(distances[2],distances[3]));int remaining[3];int rejected[3];int i,j,k;for(i=0,j=0,k=0;i<4;++i){if(distances[i]<maxDistance){remaining[j++]=i;}else{rejected[k++]=i;}}for(;j<3;++j){remaining[j]=rejected[--k];}vec3 s=vec3(samples[remaining[0]],samples[remaining[1]],samples[remaining[2]]);c=(s.x+s.y+s.z)/3.0;distances[0]=abs(c-s.x);distances[1]=abs(c-s.y);distances[2]=abs(c-s.z);float minDistance=min(distances[0],min(distances[1],distances[2]));for(i=0;i<3;++i){if(distances[i]==minDistance){break;}}return remaining[i];}void main(){float d[4];d[0]=readDepth(vUv0);d[1]=readDepth(vUv1);d[2]=readDepth(vUv2);d[3]=readDepth(vUv3);int index=findBestDepth(d);
#ifdef DOWNSAMPLE_NORMALS
vec3 n[4];n[0]=texture2D(normalBuffer,vUv0).rgb;n[1]=texture2D(normalBuffer,vUv1).rgb;n[2]=texture2D(normalBuffer,vUv2).rgb;n[3]=texture2D(normalBuffer,vUv3).rgb;
#else
vec3 n[4];n[0]=vec3(0.0);n[1]=vec3(0.0);n[2]=vec3(0.0);n[3]=vec3(0.0);
#endif
gl_FragColor=vec4(n[index],d[index]);}`,mn=`uniform vec2 texelSize;varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;varying vec2 vUv3;void main(){vec2 uv=position.xy*0.5+0.5;vUv0=uv;vUv1=vec2(uv.x,uv.y+texelSize.y);vUv2=vec2(uv.x+texelSize.x,uv.y);vUv3=uv+texelSize;gl_Position=vec4(position.xy,1.0,1.0);}`,hn=class extends S{constructor(){super({name:`DepthDownsamplingMaterial`,defines:{DEPTH_PACKING:`0`},uniforms:{depthBuffer:new A(null),normalBuffer:new A(null),texelSize:new A(new w)},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:pn,vertexShader:mn})}set depthBuffer(e){this.uniforms.depthBuffer.value=e}set depthPacking(e){this.defines.DEPTH_PACKING=e.toFixed(0),this.needsUpdate=!0}setDepthBuffer(e,t=Ie){this.depthBuffer=e,this.depthPacking=t}set normalBuffer(e){this.uniforms.normalBuffer.value=e,e===null?delete this.defines.DOWNSAMPLE_NORMALS:this.defines.DOWNSAMPLE_NORMALS=`1`,this.needsUpdate=!0}setNormalBuffer(e){this.normalBuffer=e}setTexelSize(e,t){this.uniforms.texelSize.value.set(e,t)}setSize(e,t){this.uniforms.texelSize.value.set(1/e,1/t)}},gn=class extends B{constructor({normalBuffer:e=null,resolutionScale:t=.5,width:n=H.AUTO_SIZE,height:r=H.AUTO_SIZE,resolutionX:i=n,resolutionY:a=r}={}){super(`DepthDownsamplingPass`);let o=new hn;o.normalBuffer=e,this.fullscreenMaterial=o,this.needsDepthTexture=!0,this.needsSwap=!1,this.renderTarget=new k(1,1,{minFilter:_,magFilter:_,depthBuffer:!1,type:Ue}),this.renderTarget.texture.name=`DepthDownsamplingPass.Target`,this.renderTarget.texture.generateMipmaps=!1;let s=this.resolution=new H(this,i,a,t);s.addEventListener(`change`,e=>this.setSize(s.baseWidth,s.baseHeight))}get texture(){return this.renderTarget.texture}getTexture(){return this.renderTarget.texture}getResolution(){return this.resolution}setDepthTexture(e,t=Ie){this.fullscreenMaterial.depthBuffer=e,this.fullscreenMaterial.depthPacking=t}render(e,t,n,r,i){e.setRenderTarget(this.renderToScreen?null:this.renderTarget),e.render(this.scene,this.camera)}setSize(e,t){let n=this.resolution;n.setBaseSize(e,t),this.renderTarget.setSize(n.width,n.height),this.fullscreenMaterial.setSize(e,t)}initialize(e,t,n){let r=e.getContext();if(!(r.getExtension(`EXT_color_buffer_float`)||r.getExtension(`EXT_color_buffer_half_float`)))throw Error(`Rendering to float texture is not supported.`)}},_n=`#include <packing>
#define packFloatToRGBA(v) packDepthToRGBA(v)
#define unpackRGBAToFloat(v) unpackRGBAToDepth(v)
uniform lowp sampler2D luminanceBuffer0;uniform lowp sampler2D luminanceBuffer1;uniform float minLuminance;uniform float deltaTime;uniform float tau;varying vec2 vUv;void main(){float l0=unpackRGBAToFloat(texture2D(luminanceBuffer0,vUv));
#if __VERSION__ < 300
float l1=texture2DLodEXT(luminanceBuffer1,vUv,MIP_LEVEL_1X1).r;
#else
float l1=textureLod(luminanceBuffer1,vUv,MIP_LEVEL_1X1).r;
#endif
l0=max(minLuminance,l0);l1=max(minLuminance,l1);float adaptedLum=l0+(l1-l0)*(1.0-exp(-deltaTime*tau));gl_FragColor=(adaptedLum==1.0)?vec4(1.0):packFloatToRGBA(adaptedLum);}`,vn=class extends S{constructor(){super({name:`AdaptiveLuminanceMaterial`,defines:{MIP_LEVEL_1X1:`0.0`},uniforms:{luminanceBuffer0:new A(null),luminanceBuffer1:new A(null),minLuminance:new A(.01),deltaTime:new A(0),tau:new A(1)},extensions:{shaderTextureLOD:!0},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,fragmentShader:_n,vertexShader:Dt})}set luminanceBuffer0(e){this.uniforms.luminanceBuffer0.value=e}setLuminanceBuffer0(e){this.uniforms.luminanceBuffer0.value=e}set luminanceBuffer1(e){this.uniforms.luminanceBuffer1.value=e}setLuminanceBuffer1(e){this.uniforms.luminanceBuffer1.value=e}set mipLevel1x1(e){this.defines.MIP_LEVEL_1X1=e.toFixed(1),this.needsUpdate=!0}setMipLevel1x1(e){this.mipLevel1x1=e}set deltaTime(e){this.uniforms.deltaTime.value=e}setDeltaTime(e){this.uniforms.deltaTime.value=e}get minLuminance(){return this.uniforms.minLuminance.value}set minLuminance(e){this.uniforms.minLuminance.value=e}getMinLuminance(){return this.uniforms.minLuminance.value}setMinLuminance(e){this.uniforms.minLuminance.value=e}get adaptationRate(){return this.uniforms.tau.value}set adaptationRate(e){this.uniforms.tau.value=e}getAdaptationRate(){return this.uniforms.tau.value}setAdaptationRate(e){this.uniforms.tau.value=e}},yn=class extends B{constructor(e,{minLuminance:t=.01,adaptationRate:n=1}={}){super(`AdaptiveLuminancePass`),this.fullscreenMaterial=new vn,this.needsSwap=!1,this.renderTargetPrevious=new k(1,1,{minFilter:_,magFilter:_,depthBuffer:!1}),this.renderTargetPrevious.texture.name=`Luminance.Previous`;let r=this.fullscreenMaterial;r.luminanceBuffer0=this.renderTargetPrevious.texture,r.luminanceBuffer1=e,r.minLuminance=t,r.adaptationRate=n,this.renderTargetAdapted=this.renderTargetPrevious.clone(),this.renderTargetAdapted.texture.name=`Luminance.Adapted`,this.copyPass=new kt(this.renderTargetPrevious,!1)}get texture(){return this.renderTargetAdapted.texture}getTexture(){return this.renderTargetAdapted.texture}set mipLevel1x1(e){this.fullscreenMaterial.mipLevel1x1=e}get adaptationRate(){return this.fullscreenMaterial.adaptationRate}set adaptationRate(e){this.fullscreenMaterial.adaptationRate=e}render(e,t,n,r,i){this.fullscreenMaterial.deltaTime=r,e.setRenderTarget(this.renderToScreen?null:this.renderTargetAdapted),e.render(this.scene,this.camera),this.copyPass.render(e,this.renderTargetAdapted)}},bn=`#include <tonemapping_pars_fragment>
uniform float whitePoint;
#if TONE_MAPPING_MODE == 2 || TONE_MAPPING_MODE == 3
uniform float middleGrey;
#if TONE_MAPPING_MODE == 3
uniform lowp sampler2D luminanceBuffer;
#else
uniform float averageLuminance;
#endif
vec3 Reinhard2ToneMapping(vec3 color){color*=toneMappingExposure;float l=luminance(color);
#if TONE_MAPPING_MODE == 3
float lumAvg=unpackRGBAToFloat(texture2D(luminanceBuffer,vec2(0.5)));
#else
float lumAvg=averageLuminance;
#endif
float lumScaled=(l*middleGrey)/max(lumAvg,1e-6);float lumCompressed=lumScaled*(1.0+lumScaled/(whitePoint*whitePoint));lumCompressed/=(1.0+lumScaled);return clamp(lumCompressed*color,0.0,1.0);}
#elif TONE_MAPPING_MODE == 4
#define A 0.15
#define B 0.50
#define C 0.10
#define D 0.20
#define E 0.02
#define F 0.30
vec3 Uncharted2Helper(const in vec3 x){return((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;}vec3 Uncharted2ToneMapping(vec3 color){color*=toneMappingExposure;return clamp(Uncharted2Helper(color)/Uncharted2Helper(vec3(whitePoint)),0.0,1.0);}
#endif
void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){
#if TONE_MAPPING_MODE == 2 || TONE_MAPPING_MODE == 3
outputColor=vec4(Reinhard2ToneMapping(inputColor.rgb),inputColor.a);
#elif TONE_MAPPING_MODE == 4
outputColor=vec4(Uncharted2ToneMapping(inputColor.rgb),inputColor.a);
#else
outputColor=vec4(toneMapping(inputColor.rgb),inputColor.a);
#endif
}`,xn=class extends Gt{constructor({blendFunction:e=U.SRC,adaptive:t=!1,mode:n=t?W.REINHARD2_ADAPTIVE:W.AGX,resolution:r=256,maxLuminance:i=4,whitePoint:a=i,middleGrey:o=.6,minLuminance:s=.01,averageLuminance:c=1,adaptationRate:l=1}={}){super(`ToneMappingEffect`,bn,{blendFunction:e,uniforms:new Map([[`luminanceBuffer`,new A(null)],[`maxLuminance`,new A(i)],[`whitePoint`,new A(a)],[`middleGrey`,new A(o)],[`averageLuminance`,new A(c)]])}),this.renderTargetLuminance=new k(1,1,{minFilter:ae,depthBuffer:!1}),this.renderTargetLuminance.texture.generateMipmaps=!0,this.renderTargetLuminance.texture.name=`Luminance`,this.luminancePass=new en({renderTarget:this.renderTargetLuminance}),this.adaptiveLuminancePass=new yn(this.luminancePass.texture,{minLuminance:s,adaptationRate:l}),this.uniforms.get(`luminanceBuffer`).value=this.adaptiveLuminancePass.texture,this.resolution=r,this.mode=n}get mode(){return Number(this.defines.get(`TONE_MAPPING_MODE`))}set mode(e){if(this.mode===e)return;let t=`186`.replace(/\D+/g,``)>=168?`CineonToneMapping(texel)`:`OptimizedCineonToneMapping(texel)`;switch(this.defines.clear(),this.defines.set(`TONE_MAPPING_MODE`,e.toFixed(0)),e){case W.LINEAR:this.defines.set(`toneMapping(texel)`,`LinearToneMapping(texel)`);break;case W.REINHARD:this.defines.set(`toneMapping(texel)`,`ReinhardToneMapping(texel)`);break;case W.CINEON:case W.OPTIMIZED_CINEON:this.defines.set(`toneMapping(texel)`,t);break;case W.ACES_FILMIC:this.defines.set(`toneMapping(texel)`,`ACESFilmicToneMapping(texel)`);break;case W.AGX:this.defines.set(`toneMapping(texel)`,`AgXToneMapping(texel)`);break;case W.NEUTRAL:this.defines.set(`toneMapping(texel)`,`NeutralToneMapping(texel)`);break;default:this.defines.set(`toneMapping(texel)`,`texel`)}this.adaptiveLuminancePass.enabled=e===W.REINHARD2_ADAPTIVE,this.setChanged()}getMode(){return this.mode}setMode(e){this.mode=e}get whitePoint(){return this.uniforms.get(`whitePoint`).value}set whitePoint(e){this.uniforms.get(`whitePoint`).value=e}get middleGrey(){return this.uniforms.get(`middleGrey`).value}set middleGrey(e){this.uniforms.get(`middleGrey`).value=e}get averageLuminance(){return this.uniforms.get(`averageLuminance`).value}set averageLuminance(e){this.uniforms.get(`averageLuminance`).value=e}get adaptiveLuminanceMaterial(){return this.adaptiveLuminancePass.fullscreenMaterial}getAdaptiveLuminanceMaterial(){return this.adaptiveLuminanceMaterial}get resolution(){return this.luminancePass.resolution.width}set resolution(e){let t=Math.max(0,Math.ceil(Math.log2(e))),n=2**t;this.luminancePass.resolution.setPreferredSize(n,n),this.adaptiveLuminanceMaterial.mipLevel1x1=t}getResolution(){return this.resolution}setResolution(e){this.resolution=e}get adaptive(){return this.mode===W.REINHARD2_ADAPTIVE}set adaptive(e){this.mode=e?W.REINHARD2_ADAPTIVE:W.REINHARD2}get adaptationRate(){return this.adaptiveLuminanceMaterial.adaptationRate}set adaptationRate(e){this.adaptiveLuminanceMaterial.adaptationRate=e}get distinction(){return console.warn(this.name,`distinction was removed.`),1}set distinction(e){console.warn(this.name,`distinction was removed.`)}update(e,t,n){this.adaptiveLuminancePass.enabled&&(this.luminancePass.render(e,t),this.adaptiveLuminancePass.render(e,null,null,n))}initialize(e,t,n){this.adaptiveLuminancePass.initialize(e,t,n)}},Sn=`uniform float offset;uniform float darkness;void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){const vec2 center=vec2(0.5);vec3 color=inputColor.rgb;
#if VIGNETTE_TECHNIQUE == 0
float d=distance(uv,center);color*=smoothstep(0.8,offset*0.799,d*(darkness+offset));
#else
vec2 coord=(uv-center)*vec2(offset);color=mix(color,vec3(1.0-darkness),dot(coord,coord));
#endif
outputColor=vec4(color,inputColor.a);}`,Cn=class extends Gt{constructor({blendFunction:e,eskil:t=!1,technique:n=t?fn.ESKIL:fn.DEFAULT,offset:r=.5,darkness:i=.5}={}){super(`VignetteEffect`,Sn,{blendFunction:e,defines:new Map([[`VIGNETTE_TECHNIQUE`,n.toFixed(0)]]),uniforms:new Map([[`offset`,new A(r)],[`darkness`,new A(i)]])})}get technique(){return Number(this.defines.get(`VIGNETTE_TECHNIQUE`))}set technique(e){this.technique!==e&&(this.defines.set(`VIGNETTE_TECHNIQUE`,e.toFixed(0)),this.setChanged())}get eskil(){return this.technique===fn.ESKIL}set eskil(e){this.technique=e?fn.ESKIL:fn.DEFAULT}getTechnique(){return this.technique}setTechnique(e){this.technique=e}get offset(){return this.uniforms.get(`offset`).value}set offset(e){this.uniforms.get(`offset`).value=e}getOffset(){return this.offset}setOffset(e){this.offset=e}get darkness(){return this.uniforms.get(`darkness`).value}set darkness(e){this.uniforms.get(`darkness`).value=e}getDarkness(){return this.darkness}setDarkness(e){this.darkness=e}},wn=`#include <common>
#include <packing>
#include <dithering_pars_fragment>
#define packFloatToRGBA(v) packDepthToRGBA(v)
#define unpackRGBAToFloat(v) unpackRGBAToDepth(v)
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#if DEPTH_PACKING == 3201
uniform lowp sampler2D depthBuffer;
#elif defined(GL_FRAGMENT_PRECISION_HIGH)
uniform highp sampler2D depthBuffer;
#else
uniform mediump sampler2D depthBuffer;
#endif
uniform vec2 resolution;uniform vec2 texelSize;uniform float cameraNear;uniform float cameraFar;uniform float aspect;uniform float time;varying vec2 vUv;vec4 sRGBToLinear(const in vec4 value){return vec4(mix(pow(value.rgb*0.9478672986+vec3(0.0521327014),vec3(2.4)),value.rgb*0.0773993808,vec3(lessThanEqual(value.rgb,vec3(0.04045)))),value.a);}float readDepth(const in vec2 uv){
#if DEPTH_PACKING == 3201
float depth=unpackRGBAToDepth(texture2D(depthBuffer,uv));
#else
float depth=texture2D(depthBuffer,uv).r;
#endif
#if defined(USE_LOGARITHMIC_DEPTH_BUFFER) || defined(LOG_DEPTH)
float d=pow(2.0,depth*log2(cameraFar+1.0))-1.0;float a=cameraFar/(cameraFar-cameraNear);float b=cameraFar*cameraNear/(cameraNear-cameraFar);depth=a+b/d;
#elif defined(USE_REVERSED_DEPTH_BUFFER)
depth=1.0-depth;
#endif
return depth;}float getViewZ(const in float depth){
#ifdef PERSPECTIVE_CAMERA
return perspectiveDepthToViewZ(depth,cameraNear,cameraFar);
#else
return orthographicDepthToViewZ(depth,cameraNear,cameraFar);
#endif
}vec3 RGBToHCV(const in vec3 RGB){vec4 P=mix(vec4(RGB.bg,-1.0,2.0/3.0),vec4(RGB.gb,0.0,-1.0/3.0),step(RGB.b,RGB.g));vec4 Q=mix(vec4(P.xyw,RGB.r),vec4(RGB.r,P.yzx),step(P.x,RGB.r));float C=Q.x-min(Q.w,Q.y);float H=abs((Q.w-Q.y)/(6.0*C+EPSILON)+Q.z);return vec3(H,C,Q.x);}vec3 RGBToHSL(const in vec3 RGB){vec3 HCV=RGBToHCV(RGB);float L=HCV.z-HCV.y*0.5;float S=HCV.y/(1.0-abs(L*2.0-1.0)+EPSILON);return vec3(HCV.x,S,L);}vec3 HueToRGB(const in float H){float R=abs(H*6.0-3.0)-1.0;float G=2.0-abs(H*6.0-2.0);float B=2.0-abs(H*6.0-4.0);return clamp(vec3(R,G,B),0.0,1.0);}vec3 HSLToRGB(const in vec3 HSL){vec3 RGB=HueToRGB(HSL.x);float C=(1.0-abs(2.0*HSL.z-1.0))*HSL.y;return(RGB-0.5)*C+HSL.z;}FRAGMENT_HEAD void main(){FRAGMENT_MAIN_UV vec4 color0=texture2D(inputBuffer,UV);vec4 color1=vec4(0.0);FRAGMENT_MAIN_IMAGE color0.a=clamp(color0.a,0.0,1.0);gl_FragColor=color0;
#ifdef ENCODE_OUTPUT
#include <colorspace_fragment>
#endif
#include <dithering_fragment>
}`,Tn=`uniform vec2 resolution;uniform vec2 texelSize;uniform float cameraNear;uniform float cameraFar;uniform float aspect;uniform float time;varying vec2 vUv;VERTEX_HEAD void main(){vUv=position.xy*0.5+0.5;VERTEX_MAIN_SUPPORT gl_Position=vec4(position.xy,1.0,1.0);}`,En=class extends S{constructor(e,t,n,r,i=!1){super({name:`EffectMaterial`,defines:{THREE_REVISION:`186`.replace(/\D+/g,``),DEPTH_PACKING:`0`,ENCODE_OUTPUT:`1`},uniforms:{inputBuffer:new A(null),depthBuffer:new A(null),resolution:new A(new w),texelSize:new A(new w),cameraNear:new A(.3),cameraFar:new A(1e3),aspect:new A(1),time:new A(0)},blending:0,toneMapped:!1,depthWrite:!1,depthTest:!1,dithering:i}),e&&this.setShaderParts(e),t&&this.setDefines(t),n&&this.setUniforms(n),this.copyCameraSettings(r)}set inputBuffer(e){this.uniforms.inputBuffer.value=e}setInputBuffer(e){this.uniforms.inputBuffer.value=e}get depthBuffer(){return this.uniforms.depthBuffer.value}set depthBuffer(e){this.uniforms.depthBuffer.value=e}get depthPacking(){return Number(this.defines.DEPTH_PACKING)}set depthPacking(e){this.defines.DEPTH_PACKING=e.toFixed(0),this.needsUpdate=!0}setDepthBuffer(e,t=Ie){this.depthBuffer=e,this.depthPacking=t}setShaderData(e){this.setShaderParts(e.shaderParts),this.setDefines(e.defines),this.setUniforms(e.uniforms),this.setExtensions(e.extensions)}setShaderParts(e){return this.fragmentShader=wn.replace(V.FRAGMENT_HEAD,e.get(V.FRAGMENT_HEAD)||``).replace(V.FRAGMENT_MAIN_UV,e.get(V.FRAGMENT_MAIN_UV)||``).replace(V.FRAGMENT_MAIN_IMAGE,e.get(V.FRAGMENT_MAIN_IMAGE)||``),this.vertexShader=Tn.replace(V.VERTEX_HEAD,e.get(V.VERTEX_HEAD)||``).replace(V.VERTEX_MAIN_SUPPORT,e.get(V.VERTEX_MAIN_SUPPORT)||``),this.needsUpdate=!0,this}setDefines(e){for(let t of e.entries())this.defines[t[0]]=t[1];return this.needsUpdate=!0,this}setUniforms(e){for(let t of e.entries())this.uniforms[t[0]]=t[1];return this}setExtensions(e){this.extensions={};for(let t of e)this.extensions[t]=!0;return this}get encodeOutput(){return this.defines.ENCODE_OUTPUT!==void 0}set encodeOutput(e){this.encodeOutput!==e&&(e?this.defines.ENCODE_OUTPUT=`1`:delete this.defines.ENCODE_OUTPUT,this.needsUpdate=!0)}isOutputEncodingEnabled(e){return this.encodeOutput}setOutputEncodingEnabled(e){this.encodeOutput=e}get time(){return this.uniforms.time.value}set time(e){this.uniforms.time.value=e}setDeltaTime(e){this.uniforms.time.value+=e}adoptCameraSettings(e){this.copyCameraSettings(e)}copyCameraSettings(e){e&&(this.uniforms.cameraNear.value=e.near,this.uniforms.cameraFar.value=e.far,e instanceof de?this.defines.PERSPECTIVE_CAMERA=`1`:delete this.defines.PERSPECTIVE_CAMERA,this.needsUpdate=!0)}setSize(e,t){let n=this.uniforms;n.resolution.value.set(e,t),n.texelSize.value.set(1/e,1/t),n.aspect.value=e/t}static get Section(){return V}};Number(`186`.replace(/\D+/g,``));var Dn=255/256;new Float32Array([Dn/256**3,Dn/256**2,Dn/256,Dn]),new Float32Array([Dn,Dn/256,Dn/256**2,1/256**3]);function On(e,t,n){for(let r of t){let t=`$1`+e+r.charAt(0).toUpperCase()+r.slice(1),i=RegExp(`([^\\.])(\\b`+r+`\\b)`,`g`);for(let e of n.entries())e[1]!==null&&n.set(e[0],e[1].replace(i,t))}}function kn(e,t,n){let r=t.getFragmentShader(),i=t.getVertexShader(),a=r!==void 0&&/mainImage/.test(r),o=r!==void 0&&/mainUv/.test(r);if(n.attributes|=t.getAttributes(),r===void 0)throw Error(`Missing fragment shader (${t.name})`);if(o&&(n.attributes&Rt.CONVOLUTION)!==0)throw Error(`Effects that transform UVs are incompatible with convolution effects (${t.name})`);if(!a&&!o)throw Error(`Could not find mainImage or mainUv function (${t.name})`);{let s=/\w+\s+(\w+)\([\w\s,]*\)\s*{/g,c=n.shaderParts,l=c.get(V.FRAGMENT_HEAD)||``,u=c.get(V.FRAGMENT_MAIN_UV)||``,d=c.get(V.FRAGMENT_MAIN_IMAGE)||``,f=c.get(V.VERTEX_HEAD)||``,p=c.get(V.VERTEX_MAIN_SUPPORT)||``,m=new Set,h=new Set;if(o&&(u+=`	${e}MainUv(UV);
`,n.uvTransformation=!0),i!==null&&/mainSupport/.test(i)){let t=/mainSupport *\([\w\s]*?uv\s*?\)/.test(i);p+=`	${e}MainSupport(`,p+=t?`vUv);
`:`);
`;for(let e of i.matchAll(/(?:varying\s+\w+\s+([\S\s]*?);)/g))for(let t of e[1].split(/\s*,\s*/))n.varyings.add(t),m.add(t),h.add(t);for(let e of i.matchAll(s))h.add(e[1])}for(let e of r.matchAll(s))h.add(e[1]);for(let e of t.defines.keys())h.add(e.replace(/\([\w\s,]*\)/g,``));for(let e of t.uniforms.keys())h.add(e);h.delete(`while`),h.delete(`for`),h.delete(`if`),t.uniforms.forEach((t,r)=>n.uniforms.set(e+r.charAt(0).toUpperCase()+r.slice(1),t)),t.defines.forEach((t,r)=>n.defines.set(e+r.charAt(0).toUpperCase()+r.slice(1),t));let g=new Map([[`fragment`,r],[`vertex`,i]]);On(e,h,n.defines),On(e,h,g),r=g.get(`fragment`),i=g.get(`vertex`);let ee=t.blendMode;if(n.blendModes.set(ee.blendFunction,ee),a){t.inputColorSpace!==null&&t.inputColorSpace!==n.colorSpace&&(d+=t.inputColorSpace===`srgb`?`color0 = sRGBTransferOETF(color0);
	`:`color0 = sRGBToLinear(color0);
	`),t.outputColorSpace===``?t.inputColorSpace!==null&&(n.colorSpace=t.inputColorSpace):n.colorSpace=t.outputColorSpace,d+=`${e}MainImage(color0, UV, `,(n.attributes&Rt.DEPTH)!==0&&/MainImage *\([\w\s,]*?depth[\w\s,]*?\)/.test(r)&&(d+=`depth, `,n.readDepth=!0),d+=`color1);
	`;let i=e+`BlendOpacity`;n.uniforms.set(i,ee.opacity),d+=`color0 = blend${ee.blendFunction}(color0, color1, ${i});

	`,l+=`uniform float ${i};

`}if(l+=r+`
`,i!==null&&(f+=i+`
`),c.set(V.FRAGMENT_HEAD,l),c.set(V.FRAGMENT_MAIN_UV,u),c.set(V.FRAGMENT_MAIN_IMAGE,d),c.set(V.VERTEX_HEAD,f),c.set(V.VERTEX_MAIN_SUPPORT,p),t.extensions!==null)for(let e of t.extensions)n.extensions.add(e)}}var An=class extends B{constructor(e,...t){super(`EffectPass`),this.fullscreenMaterial=new En(null,null,null,e),this.listener=e=>this.handleEvent(e),this.effects=[],this.setEffects(t),this.skipRendering=!1,this.minTime=1,this.maxTime=1/0,this.timeScale=1}set mainScene(e){for(let t of this.effects)t.mainScene=e}set mainCamera(e){this.fullscreenMaterial.copyCameraSettings(e);for(let t of this.effects)t.mainCamera=e}get encodeOutput(){return this.fullscreenMaterial.encodeOutput}set encodeOutput(e){this.fullscreenMaterial.encodeOutput=e}get dithering(){return this.fullscreenMaterial.dithering}set dithering(e){let t=this.fullscreenMaterial;t.dithering=e,t.needsUpdate=!0}setEffects(e){for(let e of this.effects)e.removeEventListener(`change`,this.listener);this.effects=e.sort((e,t)=>t.attributes-e.attributes);for(let e of this.effects)e.addEventListener(`change`,this.listener)}updateMaterial(){let e=new zt,t=0;for(let n of this.effects)if(n.blendMode.blendFunction===U.DST)e.attributes|=n.getAttributes()&Rt.DEPTH;else if((e.attributes&n.getAttributes()&Rt.CONVOLUTION)!==0)throw Error(`Convolution effects cannot be merged (${n.name})`);else kn(`e`+t++,n,e);let n=e.shaderParts.get(V.FRAGMENT_HEAD),r=e.shaderParts.get(V.FRAGMENT_MAIN_IMAGE),i=e.shaderParts.get(V.FRAGMENT_MAIN_UV),a=/\bblend\b/g;for(let t of e.blendModes.values())n+=t.getShaderCode().replace(a,`blend${t.blendFunction}`)+`
`;(e.attributes&Rt.DEPTH)===0?this.needsDepthTexture=!1:(e.readDepth&&(r=`float depth = readDepth(UV);

	`+r),this.needsDepthTexture=this.getDepthTexture()===null),e.colorSpace===`srgb`&&(r+=`color0 = sRGBToLinear(color0);
	`),e.uvTransformation?(i=`vec2 transformedUv = vUv;
`+i,e.defines.set(`UV`,`transformedUv`)):e.defines.set(`UV`,`vUv`),e.shaderParts.set(V.FRAGMENT_HEAD,n),e.shaderParts.set(V.FRAGMENT_MAIN_IMAGE,r),e.shaderParts.set(V.FRAGMENT_MAIN_UV,i);for(let[t,n]of e.shaderParts)n!==null&&e.shaderParts.set(t,n.trim().replace(/^#/,`
#`));this.skipRendering=t===0,this.needsSwap=!this.skipRendering,this.fullscreenMaterial.setShaderData(e)}recompile(){this.updateMaterial()}getDepthTexture(){return this.fullscreenMaterial.depthBuffer}setDepthTexture(e,t=Ie){this.fullscreenMaterial.depthBuffer=e,this.fullscreenMaterial.depthPacking=t;for(let n of this.effects)n.setDepthTexture(e,t)}render(e,t,n,r,i){for(let n of this.effects)n.update(e,t,r);if(!this.skipRendering||this.renderToScreen){let i=this.fullscreenMaterial;i.inputBuffer=t.texture,i.time+=r*this.timeScale,e.setRenderTarget(this.renderToScreen?null:n),e.render(this.scene,this.camera)}}setSize(e,t){this.fullscreenMaterial.setSize(e,t);for(let n of this.effects)n.setSize(e,t)}initialize(e,t,n){this.renderer=e;for(let r of this.effects)r.initialize(e,t,n);this.updateMaterial(),n!==void 0&&n!==1009&&(this.fullscreenMaterial.defines.FRAMEBUFFER_PRECISION_HIGH=`1`)}dispose(){super.dispose();for(let e of this.effects)e.removeEventListener(`change`,this.listener),e.dispose()}handleEvent(e){e.type===`change`&&this.recompile()}},jn=class extends B{constructor(e,t,{renderTarget:n,resolutionScale:r=1,width:i=H.AUTO_SIZE,height:a=H.AUTO_SIZE,resolutionX:o=i,resolutionY:s=a}={}){super(`NormalPass`),this.needsSwap=!1,this.renderPass=new dn(e,t,new g);let c=this.renderPass;c.ignoreBackground=!0,c.skipShadowMapUpdate=!0;let l=c.getClearPass();l.overrideClearColor=new O(7829503),l.overrideClearAlpha=1,this.renderTarget=n,this.renderTarget===void 0&&(this.renderTarget=new k(1,1,{minFilter:_,magFilter:_}),this.renderTarget.texture.name=`NormalPass.Target`);let u=this.resolution=new H(this,o,s,r);u.addEventListener(`change`,e=>this.setSize(u.baseWidth,u.baseHeight))}set mainScene(e){this.renderPass.mainScene=e}set mainCamera(e){this.renderPass.mainCamera=e}get texture(){return this.renderTarget.texture}getTexture(){return this.renderTarget.texture}getResolution(){return this.resolution}getResolutionScale(){return this.resolution.scale}setResolutionScale(e){this.resolution.scale=e}render(e,t,n,r,i){let a=this.renderToScreen?null:this.renderTarget;this.renderPass.render(e,a,a)}setSize(e,t){let n=this.resolution;n.setBaseSize(e,t),this.renderTarget.setSize(n.width,n.height)}};new Float32Array([0,0,0]),new Float32Array([1,0,0]),new Float32Array([1,1,0]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([1,0,0]),new Float32Array([1,0,1]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,0,1]),new Float32Array([1,0,1]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,1,0]),new Float32Array([1,1,0]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,1,0]),new Float32Array([0,1,1]),new Float32Array([1,1,1]),new Float32Array([0,0,0]),new Float32Array([0,0,1]),new Float32Array([0,1,1]),new Float32Array([1,1,1]),new Float32Array([0,-.25,.25,-.125,.125,-.375,.375]),new Float32Array([0,0]),new Float32Array([.25,-.25]),new Float32Array([-.25,.25]),new Float32Array([.125,-.125]),new Float32Array([-.125,.125]),new Uint8Array([0,0]),new Uint8Array([3,0]),new Uint8Array([0,3]),new Uint8Array([3,3]),new Uint8Array([1,0]),new Uint8Array([4,0]),new Uint8Array([1,3]),new Uint8Array([4,3]),new Uint8Array([0,1]),new Uint8Array([3,1]),new Uint8Array([0,4]),new Uint8Array([3,4]),new Uint8Array([1,1]),new Uint8Array([4,1]),new Uint8Array([1,4]),new Uint8Array([4,4]),new Uint8Array([0,0]),new Uint8Array([1,0]),new Uint8Array([0,2]),new Uint8Array([1,2]),new Uint8Array([2,0]),new Uint8Array([3,0]),new Uint8Array([2,2]),new Uint8Array([3,2]),new Uint8Array([0,1]),new Uint8Array([1,1]),new Uint8Array([0,3]),new Uint8Array([1,3]),new Uint8Array([2,1]),new Uint8Array([3,1]),new Uint8Array([2,3]),new Uint8Array([3,3]),G(0,0,0,0),new Float32Array([0,0,0,0]),G(0,0,0,1),new Float32Array([0,0,0,1]),G(0,0,1,0),new Float32Array([0,0,1,0]),G(0,0,1,1),new Float32Array([0,0,1,1]),G(0,1,0,0),new Float32Array([0,1,0,0]),G(0,1,0,1),new Float32Array([0,1,0,1]),G(0,1,1,0),new Float32Array([0,1,1,0]),G(0,1,1,1),new Float32Array([0,1,1,1]),G(1,0,0,0),new Float32Array([1,0,0,0]),G(1,0,0,1),new Float32Array([1,0,0,1]),G(1,0,1,0),new Float32Array([1,0,1,0]),G(1,0,1,1),new Float32Array([1,0,1,1]),G(1,1,0,0),new Float32Array([1,1,0,0]),G(1,1,0,1),new Float32Array([1,1,0,1]),G(1,1,1,0),new Float32Array([1,1,1,0]),G(1,1,1,1),new Float32Array([1,1,1,1]);function Mn(e,t,n){return e+(t-e)*n}function G(e,t,n,r){return Mn(Mn(e,t,.75),Mn(n,r,.75),.875)}function K(e){return e&&e.__esModule?e.default:e}var q={};q=JSON.parse(`{"architecture":"attention-v3-int8","formatVersion":3,"globalBias":[-0.32877659797668457,0.4370867609977722,-0.05251404270529747,1.3072023391723633,0.0477047860622406,0.24477416276931763,0.009111796505749226,-0.17459993064403534],"globalFeatureInverseStandardDeviation":[10.771836280822754,1.9548665285110474,1.612365484237671],"globalFeatureMean":[0.9198138117790222,-0.49808526039123535,0.03374629095196724],"globalWeights":[101,-4,7,-127,6,-11,3,1,0,-16,-7,8,-8,-1,7,-4,0,0,-12,-3,-13,1,0,2],"headBias":[-0.15895532071590424,0.007501596584916115,-0.47742825746536255,0.01632097363471985,-0.48355796933174133,-0.1052703931927681,-0.8414919376373291,-0.21046382188796997],"headWeights":[-45,-7,-45,-20,7,-13,120,-24,-15,-26,-19,1,27,-48,-4,-10,1,-5,-24,64,91,-1,-68,39,54,39,101,-40,-127,64,-41,-17,-23,-19,3,35,-2,33,3,9,-64,-32,30,42,-112,12,28,-11,15,2,-4,-7,7,-3,-5,1,76,48,-34,-67,103,-40,-26,1,58,-11,46,-41,5,-6,-17,-8,13,17,-35,45,27,-17,-28,7,-53,12,-51,6,-32,-5,58,-9,-28,-21,37,-12,1,20,2,2,11,7,-4,-9,2,-15,-1,-8,16,12,-27,-1,61,-5,-1,4,-7,-2,7,4,1,4,-2,4,-18,-16,28,6,-65,16,3,-3,-5,-2,0,-40,-21,-22,14,30,-21,49,15,-64,43,19,23,18,5,-15,21,21,30,17,-11,-6,22,-38,-20,97,-46,-5,-13,-59,26,-13,11,-2,-10,-8,2,-15,-17,-27,-9,26,7,-7,6,9,-32,5,-9,12,49,17,-1,24,20,35,14,-33,-50,-1,-4,-26,11,11,9,-80,30,9,36,6,-12,-4,-7,39,-10,-30,-49,1,-43,-20,-34,76,-36,-10,15,-8,43,31,38,-42,39,37,-7,7,8,16,28,-83,32,9,23,-13,39,119,23,-127,-24,8,-48,-29,-7,-33,-12,58,-24,-29,-19,12,-55,-90,0,126,26,42,54,22],"keyProjectionWeights":[0,-1,-1,1,1,1,1,1,-64,32,49,23,-25,4,27,-22,0,1,-1,-1,-1,1,1,0,-34,38,64,88,13,-53,-41,58,-7,-4,79,-41,27,26,14,2,-2,1,1,1,-1,-1,1,1,1,-1,-1,-1,-1,-1,1,1,4,-3,126,42,-40,-116,35,20],"name":"residual-attention-v3-50m-qat-int8-epoch-25-zo-278w","outputBias":-0.0005526235327124596,"outputWeights":[11,11,14,-27,9,-22,127,6],"quantization":{"scales":{"globalWeight":0.021090541950849095,"headWeight":0.04935851140909355,"keyWeight":0.1733924937791441,"outputWeight":0.0030087142047955295,"tapInputWeight":0.1096231754049479,"tapOutputWeight":0.017949438644286102,"valueWeight":0.013986751242596301},"scheme":"symmetric-int8-per-tensor","zeroPoint":0},"summaryQueries":[0.0038647791370749474,0.09565000981092453,0.002756686182692647,-0.08183622360229492,-0.15209506452083588,-0.0006105066277086735,0.0010439646430313587,-0.03020688332617283,0.005065929610282183,0.14488759636878967,0.003160916268825531,-0.0855727270245552,-0.3123375475406647,0.00039022407145239413,0.0037786494940519333,0.1451321840286255,-0.002009483054280281,0.0597594790160656,0.0045239729806780815,-0.08765853196382523,-0.13884992897510529,-0.0021647117100656033,0.003985927440226078,0.09727758169174194,0.007170629221946001,0.0786278173327446,0.004103775601834059,-0.1198369711637497,-0.2925199568271637,-0.002055276418104768,0.0030450925696641207,0.14401987195014954],"supportedDenoiseSamples":[4,8,16],"tapFeatureInverseStandardDeviation":[2.283243417739868,0.8810898065567017,0.8210930228233337,3.752316474914551,3.6375720500946045,2.670454978942871,10.249449729919434,0.12639354169368744,100],"tapFeatureMean":[0.010318092070519924,0.01364430133253336,0.13411010801792145,-0.004725644364953041,0.10053129494190216,0.8384788632392883,0.9203217625617981,1.7139031887054443,1],"tapInputBias":[0.4780646860599518,-0.45214661955833435,0.289407879114151,0.34804567694664,-0.1320028454065323,0.17722633481025696,0.011480014771223068,-0.26692497730255127],"tapInputWeights":[0,1,7,0,-1,-7,0,31,-2,-1,14,-126,0,0,-1,2,26,-2,0,66,-73,0,0,0,-12,22,-3,0,-76,-90,0,-1,-7,-3,58,-1,0,2,6,0,0,3,4,-40,0,0,3,-13,0,0,1,-7,-13,0,0,-7,10,0,-2,-7,0,-39,-2,0,-13,-19,0,-2,20,-1,3,-1],"tapOutputBias":[-0.3867710530757904,0.1349504142999649,0.35706064105033875,-0.5938405394554138,-0.031154220923781395,1.4079623222351074,-1.9221038818359375,0.6029739379882812],"tapOutputWeights":[18,-4,47,19,74,-94,-21,-9,73,-59,88,-10,-3,71,-7,24,20,74,24,-31,-12,-10,-15,-45,-126,2,-4,27,-5,24,35,-11,-4,9,-8,26,-10,27,26,-20,17,-50,5,-35,0,-5,12,-71,89,-58,22,-83,-115,7,-16,-89,89,22,1,-20,-22,-25,-26,44],"valueProjectionWeights":[-16,-6,40,-17,84,-76,59,51,-10,-2,-10,-1,-23,74,-70,23,-5,4,4,-7,-77,127,20,-48,-36,4,-17,-12,-4,10,29,-27,-2,11,-47,-50,-54,-3,14,11,-23,-1,109,31,4,-100,-33,-36,-19,0,-8,20,-35,-24,79,2,44,2,5,7,22,-70,-67,-35]}`);var Nn=[[`tapInputWeight`,`tapInputWeights`,8,9],[`tapOutputWeight`,`tapOutputWeights`,8,8],[`globalWeight`,`globalWeights`,8,3],[`keyWeight`,`keyProjectionWeights`,8,8],[`valueWeight`,`valueProjectionWeights`,8,8],[`headWeight`,`headWeights`,8,32],[`outputWeight`,`outputWeights`,1,8]],Pn=e=>{let t=K(q).quantization?.scales?.[e];if(!(t>0)||!Number.isFinite(t))throw Error(`The bundled N8AO neural model has no valid ${e} scale.`);return t};if(K(q).architecture!==`attention-v3-int8`||K(q).formatVersion!==3||K(q).quantization?.scheme!==`symmetric-int8-per-tensor`||K(q).quantization?.zeroPoint!==0||K(q).supportedDenoiseSamples?.join(`,`)!==`4,8,16`||Nn.some(([,e,t,n])=>K(q)[e]?.length!==t*n||K(q)[e].some(e=>!Number.isInteger(e)||e<-127||e>127)))throw Error(`The bundled N8AO neural denoise model has an unsupported layout.`);var Fn=e=>{if(!Number.isFinite(e))throw Error(`The bundled N8AO neural model contains a non-finite value.`);if(Object.is(e,-0))return`0.0`;let t=Number(e).toString();return/[.eE]/.test(t)?t:`${t}.0`},In=[`x`,`y`,`z`,`w`],Ln=e=>[...In.map(t=>`${e}.lo.${t}`),...In.map(t=>`${e}.hi.${t}`)],Rn=(e,t)=>e===0?null:e===1?t:e===-1?`(-${t})`:e<0?`(-${Fn(-e)} * ${t})`:`${Fn(e)} * ${t}`,zn=(e,t)=>e===0?null:`${Fn(e)} * ${t}`,Bn=e=>e.filter(Boolean).join(` + `)||`0.0`,Vn=(e,t,n,r,i,a)=>{let o=r.map((r,i)=>Rn(e[t*n+i],r));return`${Fn(i)} * (${Bn(o)}) + ${Fn(a[t])}`},J=(e,t=`        `)=>`vec4(\n${e.map(e=>`${t}    ${e}`).join(`,
`)}\n${t})`,Hn=({functionName:e,scaleName:t,weights:n,bias:r,width:i=8,relu:a=!1})=>{let o=Ln(`inputToken`),s=Pn(t),c=Array.from({length:8},(e,t)=>Vn(n,t,i,o,s,r)),l=J(c.slice(0,4)),u=J(c.slice(4)),d=e=>a?`max(${e}, vec4(0.0))`:e;return`
    NeuralToken neural${e[0].toUpperCase()}${e.slice(1)}(NeuralToken inputToken) {
        return NeuralToken(
            ${d(l)},
            ${d(u)}
        );
    }
`},Un=(e,t,n,r,i,a,o,s={})=>Array.from({length:i},(i,c)=>{let l=t[c];for(let t=0;t<a;t++){let i=e[c*a+t]*o;l-=i*r[t]*n[t],Object.hasOwn(s,t)&&(l+=i*r[t]*s[t])}return l}),Wn=Pn(`tapInputWeight`),Gn=Un(K(q).tapInputWeights,K(q).tapInputBias,K(q).tapFeatureMean,K(q).tapFeatureInverseStandardDeviation,8,9,Wn,{8:1}),Kn=Ln(`scaledInput`),qn=Array.from({length:8},(e,t)=>Vn(K(q).tapInputWeights,t,9,Kn,Wn,Gn)),Jn=`
    NeuralToken neuralTapInput(NeuralToken raw) {
        NeuralToken scaledInput = NeuralToken(
            raw.lo * ${J(K(q).tapFeatureInverseStandardDeviation.slice(0,4),`            `)},
            raw.hi * ${J(K(q).tapFeatureInverseStandardDeviation.slice(4,8),`            `)}
        );
        return NeuralToken(
            max(${J(qn.slice(0,4))}, vec4(0.0)),
            max(${J(qn.slice(4))}, vec4(0.0))
        );
    }
`,Yn=Pn(`globalWeight`),Xn=Un(K(q).globalWeights,K(q).globalBias,K(q).globalFeatureMean,K(q).globalFeatureInverseStandardDeviation,8,3,Yn),Zn=In.slice(0,3).map(e=>`scaledInput.${e}`),Qn=Array.from({length:8},(e,t)=>Vn(K(q).globalWeights,t,3,Zn,Yn,Xn)),$n=`
    NeuralToken neuralEncodeGlobal(vec4 raw) {
        vec3 scaledInput = raw.xyz * vec3(
            ${K(q).globalFeatureInverseStandardDeviation.map(Fn).join(`, `)}
        );
        return NeuralToken(
            max(${J(Qn.slice(0,4))}, vec4(0.0)),
            max(${J(Qn.slice(4))}, vec4(0.0))
        );
    }
`,er=Ln(`key`),tr=`
    vec4 neuralQueryScores(NeuralToken key) {
        return ${J(Array.from({length:4},(e,t)=>Bn(er.map((e,n)=>zn(K(q).summaryQueries[t*8+n],e)))))};
    }
`,nr=[];for(let e=0;e<4;e++)nr.push(...In.map(t=>`runningSummaryLo[${e}].${t}`),...In.map(t=>`runningSummaryHi[${e}].${t}`));var rr=Pn(`headWeight`),ir=Array.from({length:8},(e,t)=>Vn(K(q).headWeights,t,32,nr,rr,K(q).headBias)),ar=`
    NeuralToken neuralHead(
        vec4 runningSummaryLo[4],
        vec4 runningSummaryHi[4]
    ) {
        return NeuralToken(
            max(${J(ir.slice(0,4))}, vec4(0.0)),
            max(${J(ir.slice(4))}, vec4(0.0))
        );
    }
`,or=`
    float neuralOutput(NeuralToken head) {
        return ${Vn(K(q).outputWeights,0,8,Ln(`head`),Pn(`outputWeight`),[K(q).outputBias])};
    }
`,sr=[Jn,Hn({functionName:`tapOutput`,scaleName:`tapOutputWeight`,weights:K(q).tapOutputWeights,bias:K(q).tapOutputBias,relu:!0}),$n,Hn({functionName:`keyProject`,scaleName:`keyWeight`,weights:K(q).keyProjectionWeights,bias:Array(8).fill(0)}),Hn({functionName:`valueProject`,scaleName:`valueWeight`,weights:K(q).valueProjectionWeights,bias:Array(8).fill(0)}),tr,ar,or].join(`
`);Nn.reduce((e,[,t])=>e+K(q)[t].length,0),Nn.reduce((e,[,t])=>e+K(q)[t].filter(e=>e!==0).length,0),`${sr}`;var cr=e=>typeof e==`object`&&e&&`current`in e?e.current:e;function lr(e,t){return(0,j.useCallback)(n=>{if(e.current=n,typeof t!=`function`){t&&(t.current=n);return}let r=t(n);if(typeof r==`function`)return()=>{e.current=null,r()}},[e,t])}function ur(e,t){let n=e.__r3f;return n?n.children.map(e=>e.object).filter(t):[]}function dr(e,t){let n=e.current;return t.length===n.length&&t.every((e,t)=>e===n[t])?!1:(e.current=t,!0)}function fr(e,t){let n=e;for(let e of t.split(`-`)){if(n==null)return;n=n[e]}return n}function pr(e,t,n){let r=t.split(`-`),i=e;for(let e=0;e<r.length-1;e++){if(i==null)return;i=i[r[e]]}i!=null&&(i[r[r.length-1]]=n)}function mr(e,t,n,r=fr,i=pr){let a=(0,j.useRef)(null),o=he(e=>e.invalidate);(0,j.useLayoutEffect)(()=>{let s=cr(e);if(!s)return;a.current?.instance!==s&&(a.current={instance:s,defaults:new Map,applied:new Map});let{defaults:c,applied:l}=a.current,u=!1;for(let e of n){if(!c.has(e)){let t=r(s,e);c.set(e,t),l.set(e,t)}let n=t[e]===void 0?c.get(e):t[e];Object.is(l.get(e),n)||(i(s,e,n),l.set(e,n),u=!0)}u&&o()})}var hr=new WeakMap,gr=0,_r=[`blendMode-blendFunction`,`blendMode-opacity-value`];function vr(e){return function({blendFunction:t,opacity:n,ref:r,...i}){let a=hr.get(e);if(!a){let t=`@react-three/postprocessing/${e.name}-${gr++}`;Fe({[t]:e}),hr.set(e,a=t)}let o=he(e=>e.camera),s=(0,j.useRef)(null),c=lr(s,r);return mr(s,{"blendMode-blendFunction":t,"blendMode-opacity-value":n},_r),(0,M.jsx)(a,{ref:c,camera:o,...i})}}var yr=(0,j.createContext)(null),br=e=>(e.getAttributes()&2)==2,xr=e=>/mainUv/.test(e.getFragmentShader()??``);function Sr(e){let t=new WeakMap;return{acquire(n,r){let i=t.get(n);i?(i.count++,i.forcedValue=r):t.set(n,{count:1,original:n[e],forcedValue:r})},release(n){let r=t.get(n);r&&--r.count<=0&&(n[e]===r.forcedValue&&(n[e]=r.original),t.delete(n))}}}var Cr=Sr(`autoClear`),wr=Sr(`toneMapping`),Tr=new w,Er=(e,t)=>new dn(e,t),Dr=new WeakSet,Or=new WeakSet;function kr(e){e instanceof An&&e.setEffects([]),B.prototype.dispose.call(e)}function Ar(e){Dr.has(e)&&kr(e)}function jr(e,t,n){let r=[];for(let i=0;i<e.length;i++){let a=e[i];if(a instanceof Gt){let o=[a],s=br(a),c=xr(a);if(n!==`none`){let t;for(;(t=e[i+1])instanceof Gt;){let e=br(t),r=xr(t);if(n===`auto`&&(s&&e||s&&r||c&&e))break;o.push(t),s||(s=e),c||(c=r),i++}}let l=new An(t,...o);Dr.add(l),r.push(l)}else a instanceof B&&r.push(a)}return r}var Mr=(0,j.memo)(function({children:e,camera:t,scene:n,resolutionScale:r,enabled:i=!0,renderPriority:a=1,autoClear:o=!0,autoRenderToScreen:s=!0,depthBuffer:c,enableNormalPass:l,stencilBuffer:u,multisampling:d=8,frameBufferType:f=ee,renderPass:p=Er,mergeMode:m=`auto`,ref:h}){let{gl:g,scene:te,camera:ne}=he(),_=n||te,v=t||ne;g.getSize(Tr);let[y,re]=(0,j.useState)(null),[,ie]=(0,j.useReducer)(e=>e+1,0);(0,j.useEffect)(()=>{Cr.acquire(g,!1);let e=new Lt(g,{depthBuffer:c,stencilBuffer:u,multisampling:d,frameBufferType:f});e.autoRenderToScreen=s,e.addPass(p(_,v));let t=null,n=null;return l&&(t=new jn(_,v),t.enabled=!1,e.addPass(t),r!==void 0&&(n=new gn({normalBuffer:t.texture,resolutionScale:r}),n.enabled=!1,e.addPass(n))),e.setSize(Tr.width,Tr.height),re({composer:e,normalPass:t,downSamplingPass:n}),()=>{for(let t of e.passes)Ar(t);e.dispose(),Cr.release(g)}},[v,g,c,u,d,f,s,p,_,l,r]);let ae=(0,j.useRef)({width:-1,height:-1,pixelRatio:-1});D((e,t)=>{if(!i||!y)return;let{composer:n}=y;g.getSize(Tr);let r=g.getPixelRatio(),a=ae.current;(Tr.width!==a.width||Tr.height!==a.height||r!==a.pixelRatio)&&(n.setSize(Tr.width,Tr.height),a.width=Tr.width,a.height=Tr.height,a.pixelRatio=r);let s=g.autoClear;g.autoClear=o,u&&!o&&g.clearStencil(),n.render(t),g.autoClear=s},i?a:0);let b=(0,j.useRef)(null),oe=(0,j.useRef)([]),[se,ce]=(0,j.useState)(0);(0,j.useLayoutEffect)(()=>{if(!y)return;let e=ur(b.current,e=>e instanceof Gt||e instanceof B);dr(oe,e)&&ce(e=>e+1)}),(0,j.useLayoutEffect)(()=>{if(!y)return;let{composer:e,normalPass:t,downSamplingPass:n}=y,r=jr(oe.current,v,m);if(r.some(e=>Or.has(e))){let e=new kt;Dr.add(e),r.push(e)}for(let t of r)e.addPass(t);return r.length&&(t&&(t.enabled=!0),n&&(n.enabled=!0)),()=>{for(let t of r)e.removePass(t),Ar(t);t&&(t.enabled=!1),n&&(n.enabled=!1)}},[y,se,v,m]),(0,j.useEffect)(()=>(wr.acquire(g,0),g.toneMapping=0,()=>{wr.release(g)}),[g]);let le=(0,j.useMemo)(()=>y?{composer:y.composer,normalPass:y.normalPass,downSamplingPass:y.downSamplingPass,resolutionScale:r,camera:v,scene:_,requestRebuild:ie,autoClear:o}:null,[y,r,v,_,ie,o]);return(0,j.useImperativeHandle)(h,()=>y?.composer,[y]),le?(0,M.jsx)(yr.Provider,{value:le,children:(0,M.jsx)(`group`,{ref:b,children:e})}):null}),Nr=vr(un);function Pr({blendFunction:e=0,luminanceThreshold:t,luminanceSmoothing:n,mipmapBlur:r,radius:i,levels:a,resolutionScale:o,resolutionX:s,resolutionY:c,...l}){let u=(0,j.useMemo)(()=>[{luminanceThreshold:t,luminanceSmoothing:n,mipmapBlur:r,radius:i,levels:a,resolutionScale:o,resolutionX:s,resolutionY:c}],[t,n,r,i,a,o,s,c]);return(0,M.jsx)(Nr,{blendFunction:e,args:u,...l})}var Fr=vr(xn);function Ir({minLuminance:e,maxLuminance:t,...n}){let r=(0,j.useMemo)(()=>[{minLuminance:e,maxLuminance:t}],[e,t]);return(0,M.jsx)(Fr,{args:r,...n})}var Lr=vr(Cn),Rr=[{dir:[1,.35],steepness:.17,length:42},{dir:[.65,1],steepness:.13,length:27},{dir:[-.45,1],steepness:.11,length:17},{dir:[.2,-1],steepness:.08,length:10.5},{dir:[-1,-.55],steepness:.06,length:6.8}],zr=.62,Br=9.8,Vr=Rr.map(e=>{let t=Math.hypot(e.dir[0],e.dir[1]),n=2*Math.PI/e.length;return{dx:e.dir[0]/t,dz:e.dir[1]/t,k:n,c:Math.sqrt(Br/n),steepness:e.steepness}});function Hr(e,t,n,r){let i=n*zr,a=0;for(let n of Vr){let o=n.k*(n.dx*e+n.dz*t-n.c*i);a+=n.steepness*r/n.k*Math.sin(o)}return a}function Ur(e,t,n,r){let i=n*zr,a=0,o=0;for(let n of Vr){let s=n.k*(n.dx*e+n.dz*t-n.c*i),c=n.steepness*r*Math.cos(s);a+=n.dx*c,o+=n.dz*c}let s=Math.hypot(a,1,o);return[-a/s,1/s,-o/s]}var Wr=e=>Number.isInteger(e)?e.toFixed(1):String(e),Gr=`
#define WAVE_COUNT ${Vr.length}
const float WAVE_TIME = ${Wr(zr)};
vec3 gerstnerWave(vec4 w, vec2 p, float t, float rough, inout vec3 tangent, inout vec3 binormal) {
  float k = w.w;
  float c = sqrt(${Wr(Br)} / k);
  vec2 d = w.xy;
  float steep = w.z * rough;
  float ph = k * (dot(d, p) - c * t);
  float a = steep / k;
  float s = sin(ph);
  float co = cos(ph);
  tangent += vec3(-d.x * d.x * steep * s, d.x * steep * co, -d.x * d.y * steep * s);
  binormal += vec3(-d.x * d.y * steep * s, d.y * steep * co, -d.y * d.y * steep * s);
  return vec3(d.x * a * co, a * s, d.y * a * co);
}
vec3 gerstner(vec2 p, float time, float rough, inout vec3 tangent, inout vec3 binormal) {
  float t = time * WAVE_TIME;
  vec3 sum = vec3(0.0);
${Vr.map(e=>`  sum += gerstnerWave(vec4(${Wr(e.dx)}, ${Wr(e.dz)}, ${Wr(e.steepness)}, ${Wr(e.k)}), p, t, rough, tangent, binormal);`).join(`
`)}
  return sum;
}
`,Y={uTime:{value:0},uSkyTop:{value:new T},uSkyHorizon:{value:new T},uFog:{value:new T},uSunDir:{value:new T(0,.2,-1)},uSunColor:{value:new T(1,.9,.7)},uSunIntensity:{value:1},uFlash:{value:0},uFogNear:{value:45},uFogFar:{value:230},uDeep:{value:new T},uShallow:{value:new T},uRough:{value:.7},uFoam:{value:.3},uClouds:{value:.5},uCloudColor:{value:new T(1,1,1)},uStars:{value:0},uRain:{value:0},uGlory:{value:0},uLight:{value:1},uShip:{value:new T}};function Kr(e,t,n){Y.uTime.value=t,Y.uSkyTop.value.fromArray(e.skyTop),Y.uSkyHorizon.value.fromArray(e.skyHorizon),Y.uFog.value.fromArray(e.fog),Y.uSunDir.value.fromArray(e.sunDir),Y.uSunColor.value.fromArray(e.sun),Y.uSunIntensity.value=e.sunIntensity,Y.uFlash.value=n,Y.uFogNear.value=e.fogNear,Y.uFogFar.value=e.fogFar,Y.uDeep.value.fromArray(e.deep),Y.uShallow.value.fromArray(e.shallow),Y.uRough.value=e.rough,Y.uFoam.value=e.foam,Y.uClouds.value=e.clouds,Y.uCloudColor.value.fromArray(e.cloud),Y.uStars.value=e.stars,Y.uRain.value=e.rain,Y.uGlory.value=e.glory,Y.uLight.value=e.light}var qr=9;function Jr(){let e=new ne;e.setAttribute(`position`,new C([0,.06,-.38,0,-.05,-.3,0,0,.42,0,0,-.12,0,0,.16,-.95,.04,.06,0,0,-.12,.95,.04,.06,0,0,.16],3)),e.setAttribute(`aWing`,new C([0,0,0,0,0,1,0,1,0],1));let t=new Float32Array(36);for(let e=0;e<qr;e++)t.set([e/qr,9+e%4*3.2,7+e%3*2.4,.18+e%5*.035],e*4);return e.setAttribute(`aSeed`,new le(t,4)),e.instanceCount=qr,e}function Yr(){let e=(0,j.useRef)(null),t=(0,j.useMemo)(Jr,[]),n=(0,j.useMemo)(()=>new S({side:2,uniforms:{uTime:Y.uTime,uShip:Y.uShip,uFog:Y.uFog,uFogNear:Y.uFogNear,uFogFar:Y.uFogFar,uLight:Y.uLight,uScale:{value:1}},vertexShader:`
          attribute float aWing;
          attribute vec4 aSeed;
          uniform float uTime;
          uniform vec3 uShip;
          uniform float uScale;
          varying float vDist;
          varying float vTip;
          void main() {
            float phase = aSeed.x * 6.2831;
            float flap = sin(uTime * (7.0 + aSeed.x * 3.0) + phase * 3.0) * 0.75;
            vec3 p = position;
            float tip = aWing * abs(p.x);
            p.y += sin(flap) * tip;
            p.x *= mix(1.0, cos(flap), aWing);
            float a = uTime * aSeed.w + phase;
            vec3 center = vec3(uShip.x, 0.0, uShip.y);
            vec3 orbit = vec3(cos(a) * aSeed.y, aSeed.z + sin(uTime * 0.7 + phase) * 0.8, sin(a) * aSeed.y);
            float heading = 3.14159 - a;
            mat3 rot = mat3(cos(heading), 0.0, -sin(heading), 0.0, 1.0, 0.0, sin(heading), 0.0, cos(heading));
            vec3 world = center + orbit + rot * (p * 1.5 * uScale);
            vec4 mv = viewMatrix * vec4(world, 1.0);
            vDist = -mv.z;
            vTip = aWing;
            gl_Position = projectionMatrix * mv;
          }`,fragmentShader:`
          uniform vec3 uFog;
          uniform float uFogNear;
          uniform float uFogFar;
          uniform float uLight;
          varying float vDist;
          varying float vTip;
          void main() {
            vec3 col = mix(vec3(0.92, 0.92, 0.9), vec3(0.18, 0.18, 0.2), vTip * 0.8) * (0.35 + 0.65 * uLight);
            col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vDist));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`}),[]);return(0,j.useEffect)(()=>()=>(t.dispose(),n.dispose()),[t,n]),D(()=>{let t=e.current;t&&(t.visible=d.birds>.03,n.uniforms.uScale.value=d.birds)}),(0,M.jsx)(`mesh`,{ref:e,geometry:t,material:n,frustumCulled:!1})}function Xr(e,t=!1){let n=e[0].index!==null,r=new Set(Object.keys(e[0].attributes)),i=new Set(Object.keys(e[0].morphAttributes)),a={},o={},s=e[0].morphTargetsRelative,c=new ye,l=0;for(let u=0;u<e.length;++u){let d=e[u],f=0;if(n!==(d.index!==null))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.`),null;for(let e in d.attributes){if(!r.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure "`+e+`" attribute exists among all geometries, or in none of them.`),null;a[e]===void 0&&(a[e]=[]),a[e].push(d.attributes[e]),f++}if(f!==r.size)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. Make sure all geometries have the same number of attributes.`),null;if(s!==d.morphTargetsRelative)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. .morphTargetsRelative must be consistent throughout all geometries.`),null;for(let e in d.morphAttributes){if(!i.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`.  .morphAttributes must be consistent throughout all geometries.`),null;o[e]===void 0&&(o[e]=[]),o[e].push(d.morphAttributes[e])}if(t){let e;if(n)e=d.index.count;else if(d.attributes.position!==void 0)e=d.attributes.position.count;else return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. The geometry must have either an index or a position attribute`),null;c.addGroup(l,e,u),l+=e}}if(n){let t=0,n=[];for(let r=0;r<e.length;++r){let i=e[r].index;for(let e=0;e<i.count;++e)n.push(i.getX(e)+t);t+=e[r].attributes.position.count}c.setIndex(n)}for(let e in a){let t=Zr(a[e]);if(!t)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` attribute.`),null;c.setAttribute(e,t)}for(let e in o){let t=o[e][0].length;if(t!==0){c.morphAttributes=c.morphAttributes||{},c.morphAttributes[e]=[];for(let n=0;n<t;++n){let t=[];for(let r=0;r<o[e].length;++r)t.push(o[e][r][n]);let r=Zr(t);if(!r)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` morphAttribute.`),null;c.morphAttributes[e].push(r)}}}return c}function Zr(e){let t,n,r,i=-1,a=0;for(let o=0;o<e.length;++o){let s=e[o];if(t===void 0&&(t=s.array.constructor),t!==s.array.constructor)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.`),null;if(n===void 0&&(n=s.itemSize),n!==s.itemSize)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.`),null;if(r===void 0&&(r=s.normalized),r!==s.normalized)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.`),null;if(i===-1&&(i=s.gpuType),i!==s.gpuType)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.`),null;a+=s.count*n}let o=new t(a),s=new ze(o,n,r),c=0;for(let t=0;t<e.length;++t){let r=e[t];if(r.isInterleavedBufferAttribute){let e=c/n;for(let t=0,i=r.count;t<i;t++)for(let i=0;i<n;i++){let n=r.getComponent(t,i);s.setComponent(t+e,i,n)}}else o.set(r.array,c);c+=r.count*n}return i!==void 0&&(s.gpuType=i),s}function Qr(e,t,r,i,a,o){D(s=>{let c=m(n.current,r,i,a),l=e.current;if(l&&(l.visible=c>.04,l.visible)){for(let e of t){let t=e;t.uniforms?.uVis?t.uniforms.uVis.value=c:(e.opacity=c,e.transparent=c<.999)}o?.(c,s.clock.elapsedTime)}})}function $r(e){let t=Xr(e.map(e=>{let t=e.index?e.toNonIndexed():e;return t.deleteAttribute(`uv`),t.computeVertexNormals(),t}),!1);if(!t)throw Error(`could not merge landmark geometry`);return t}function ei(e,t,n,r){let i=Math.imul(e|0,374761393)^Math.imul(t|0,668265263)^Math.imul(n|0,2147483647)^Math.imul(r|0,1274126177);return i=Math.imul(i^i>>>13,1274126177),((i^i>>>16)>>>0)/4294967295}function ti(e,t,n,r=1){let i=Math.floor(e),a=Math.floor(t),o=Math.floor(n),s=e-i,c=t-a,l=n-o,u=s*s*(3-2*s),d=c*c*(3-2*c),f=l*l*(3-2*l),p=(e,t,n)=>e+(t-e)*n,m=(e,t,n)=>ei(i+e,a+t,o+n,r);return p(p(p(m(0,0,0),m(1,0,0),u),p(m(0,1,0),m(1,1,0),u),d),p(p(m(0,0,1),m(1,0,1),u),p(m(0,1,1),m(1,1,1),u),d),f)}function ni(e,t,n,r=1,i=4){let a=0,o=.5,s=1;for(let c=0;c<i;c++)a+=o*ti(e*s,t*s,n*s,r+c*17),s*=2.03,o*=.5;return a}function ri(e,t,n,r,i=!0){let a=e.getAttribute(`position`),o=1/0;for(let e=0;e<a.count;e++)o=Math.min(o,a.getY(e));for(let e=0;e<a.count;e++){let s=a.getX(e),c=a.getY(e),l=a.getZ(e),u=Math.hypot(s,l);if(u<1e-4)continue;let d=ni(s*n,c*n,l*n,r)-.5,f=i?Math.min(1,(c-o)/3+.35):1,p=1+d*t*f/Math.max(u,1);a.setXYZ(e,s*p,c+d*t*.25,l*p)}return e.computeVertexNormals(),e}function ii(e,t){let n=e.index?e.toNonIndexed():e;n.computeVertexNormals();let r=n.getAttribute(`position`),i=n.getAttribute(`normal`),a=[],o=new O(t.sand??t.rock),s=new O(t.grass??t.rock),c=new O(t.rock),l=new O(t.snow??t.rock),u=new O;for(let e=0;e<r.count;e++){let n=r.getY(e),d=i.getY(e);t.snow&&n>(t.snowLine??1e9)?u.copy(l):t.sand&&n<(t.sandLine??1.2)?u.copy(o):t.grass&&d>.55?u.copy(s):u.copy(c);let f=.9+ti(r.getX(e)*.3,n*.3,r.getZ(e)*.3,7)*(t.tint??.2);a.push(u.r*f,u.g*f,u.b*f)}return n.setAttribute(`color`,new C(a,3)),n}function X(e,t,n,r,i={}){let a=e.clone(),o=i.s??1,[s,c,l]=typeof o==`number`?[o,o,o]:o;return a.scale(s,c,l),i.rx&&a.rotateX(i.rx),i.ry&&a.rotateY(i.ry),i.rz&&a.rotateZ(i.rz),a.translate(t,n,r),a}function Z(e,t){let n=e.index?e.toNonIndexed():e,r=new O(t),i=n.getAttribute(`position`).count,a=new Float32Array(i*3);for(let e=0;e<i;e++)a.set([r.r,r.g,r.b],e*3);return n.setAttribute(`color`,new C(a,3)),n}var ai=-780;function oi(){let e=new Re(48,56,18,0,Math.PI*2,0,Math.PI/2);e.scale(1,.34,1),e.translate(0,-2,0);let t=[ii(ri(e,14,.06,71,!1),{sand:`#ecd9a6`,sandLine:1.4,grass:`#56893f`,rock:`#8a7a62`,tint:.35})];for(let[e,n,r,i]of[[0,0,16,70],[-22,8,9,38],[20,12,8,32],[-10,-18,7,26],[26,-14,6,22]]){let a=ri(new Ce(r,i,14,12),r*.5,.12,e+n+90);t.push(ii(X(a,e,i/2+2,n),{rock:`#9c8a6c`,grass:`#6b8f4a`,tint:.35}))}return $r(t)}var si=e=>new S({uniforms:{uTime:Y.uTime,uVis:{value:0},uStrength:{value:e},uFogNear:Y.uFogNear,uFogFar:Y.uFogFar},transparent:!0,depthWrite:!1,blending:2,vertexShader:`
      varying vec3 vN;
      varying vec3 vView;
      varying float vY;
      varying float vDist;
      void main() {
        vY = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      uniform float uTime;
      uniform float uVis;
      uniform float uStrength;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vN;
      varying vec3 vView;
      varying float vY;
      varying float vDist;
      void main() {
        float facing = pow(abs(dot(normalize(vN), normalize(vView))), 1.8);
        float fadeY = smoothstep(0.0, 0.04, vY) * (1.0 - smoothstep(0.2, 0.9, vY));
        float shimmer = 0.8 + 0.2 * sin(vY * 90.0 - uTime * 2.6);
        float fog = 1.0 - 0.6 * smoothstep(uFogNear, uFogFar * 1.6, vDist);
        vec3 col = vec3(1.0, 0.8, 0.42) * uStrength * facing * fadeY * shimmer * uVis * fog;
        gl_FragColor = vec4(col, 1.0);
      }`});function ci({sparkles:e}){let t=(0,j.useRef)(null),n=(0,j.useMemo)(()=>({land:new x({vertexColors:!0,flatShading:!0,roughness:.9}),core:si(3.4),halo:si(.45),geo:{island:oi(),core:new E(2.6,3.8,720,24,1,!0),halo:new E(10,15,720,24,1,!0)}}),[]);return(0,j.useEffect)(()=>()=>{Object.values(n.geo).forEach(e=>e.dispose()),[n.land,n.core,n.halo].forEach(e=>e.dispose())},[n]),Qr(t,[n.land,n.core,n.halo],4,.85,2),(0,M.jsxs)(`group`,{ref:t,position:[0,0,ai],children:[(0,M.jsx)(`mesh`,{geometry:n.geo.island,material:n.land}),(0,M.jsx)(`mesh`,{geometry:n.geo.core,material:n.core,position:[0,360,0],renderOrder:4}),(0,M.jsx)(`mesh`,{geometry:n.geo.halo,material:n.halo,position:[0,360,0],renderOrder:4}),(0,M.jsx)(Le,{count:e,scale:[110,90,110],position:[0,40,0],size:9,speed:.35,opacity:.9,color:`#ffd98a`,noise:.8})]})}var li=-330,ui=e=>{let t=Math.sin(e*12.9898)*43758.5453;return t-Math.floor(t)};function di(e,t,n,r,i){let a=new E(.22,.38,7,6,8),o=a.getAttribute(`position`);for(let e=0;e<o.count;e++){let t=o.getY(e)+3.5;o.setX(e,o.getX(e)+(t/7)**2*1.6*r)}a.computeVertexNormals();let s=[Z(X(a,e,n+3.5,t,{ry:i}),`#6e4d2f`)],c=new Ce(.55,4.6,4,1);for(let a=0;a<7;a++){let o=a/7*Math.PI*2+i;s.push(Z(X(c,e+Math.cos(o)*1.6+1.6*r,n+6.7,t+Math.sin(o)*1.6,{rz:-Math.cos(o)*1.25,rx:Math.sin(o)*1.25,s:[1,1,.35]}),a%2?`#2f7a36`:`#3c8c3f`))}return s}function fi(e,t,n,r){let i=new Re(e,40,16,0,Math.PI*2,0,Math.PI/2);i.scale(1,t/e,1),i.translate(0,-1.6,0),ri(i,e*.45,.08,n,!1);let a=[ii(i,{sand:`#e2cf9c`,sandLine:.9,grass:`#3e7f3a`,rock:`#7a6a52`,tint:.35}),Z(X(new E(e*1.12,e*1.2,1.6,40),0,-.55,0),`#e8d6a4`)];for(let i=0;i<r;i++){let o=n*1.7+i/r*Math.PI*2,s=e*(.35+.35*ti(i,n,1)),c=Math.cos(o)*s,l=Math.sin(o)*s,u=t*Math.sqrt(Math.max(0,1-(s/e)**2))*.8-1.8;a.push(...di(c,l,u,(i%2?1:-1)*.8,o))}return $r(a)}function pi(){let e=[],t=new He(1,1);for(let[n,r,i]of[[0,0,1],[-17,11,.8],[14,14,.9]]){let a=ri(new E(3.4*i,5.2*i,48*i,12,8),1.6,.18,n+3);e.push(Z(X(a,n,24*i-2,r),`#8b6b4b`));for(let t=0;t<6;t++){let a=t/6*Math.PI*2+n;e.push(Z(X(new Ce(1.3*i,16*i,6),n+Math.cos(a)*5*i,4*i,r+Math.sin(a)*5*i,{rz:-Math.cos(a)*.55,rx:Math.sin(a)*.55}),`#7a5c3f`))}for(let a=0;a<7;a++){let o=a/7*Math.PI*2+r,s=a===0?0:8*i;e.push(Z(X(t,n+Math.cos(o)*s,50*i+a%3*2.5,r+Math.sin(o)*s,{s:(a===0?13:9)*i}),a%2?`#3d7d45`:`#4f9150`))}}let n=new Re(30,32,10,0,Math.PI*2,0,Math.PI/2);return n.scale(1,.14,1),n.translate(0,-1.2,0),e.push(ii(ri(n,7,.1,19,!1),{sand:`#d9c793`,sandLine:1,grass:`#4a7f3f`,rock:`#6f624f`})),$r(e)}function mi(){let e=[],t=new He(1,2);for(let[n,r,i,a]of[[0,0,0,12],[11,-1,3,9],[-12,-1,-2,10],[4,-2,-10,9],[-5,-2,10,8],[18,-3,-6,6],[-20,-3,7,6]])e.push(Z(X(t,n,r,i,{s:[a,a*.55,a]}),`#fbf6f2`));let n=new Oe(1.4,7,1.4);for(let[t,r]of[[-6,-3],[-2,-5],[3,-4]])e.push(Z(X(n,t,7.5,r),`#d8cdb6`));return $r(e)}function hi(){let e=[[.01,0],[3.2,.1],[3.3,.7],[2.7,1.8],[2.25,3.8],[1.7,5.4],[.6,6.2],[.01,6.3]].map(([e,t])=>new w(e,t));return new De(e,32)}var gi=()=>new S({uniforms:{uTime:Y.uTime,uVis:{value:0}},transparent:!0,depthWrite:!1,blending:2,vertexShader:`
      attribute vec4 aSeed;
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float life = fract(aSeed.w + uTime * (0.02 + aSeed.z * 0.018));
        float r = 0.45 + aSeed.x * aSeed.x * 1.6;
        vec3 base = vec3((aSeed.x - 0.5) * 64.0, -1.0, (aSeed.y - 0.5) * 44.0);
        vec3 p = base + vec3(sin(uTime * 0.6 + aSeed.w * 20.0) * 1.8, life * 62.0, cos(uTime * 0.5 + aSeed.z * 20.0) * 1.8);
        float grow = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.86, 1.0, life));
        vec4 mv = modelViewMatrix * vec4(p + position * r * grow, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      uniform float uTime;
      uniform float uVis;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vec3(0.0, 0.33, 0.67)) + uTime * 0.4);
        vec3 col = mix(vec3(0.95), irid, 0.75) * (0.12 + fres * 1.5);
        gl_FragColor = vec4(col * uVis, 1.0);
      }`});function _i(e){let t=new ne,n=new He(1,2);t.index=n.index,t.setAttribute(`position`,n.getAttribute(`position`)),t.setAttribute(`normal`,n.getAttribute(`normal`));let r=new Float32Array(e*4);for(let t=0;t<e*4;t++)r[t]=ui(t+1);return t.setAttribute(`aSeed`,new le(r,4)),t.instanceCount=e,t}function vi({bubbles:e}){let t=(0,j.useRef)(null),n=(0,j.useRef)(null),r=(0,j.useMemo)(()=>({land:new x({vertexColors:!0,flatShading:!0,roughness:.92}),cloud:new x({vertexColors:!0,roughness:1,emissive:`#3a2b3a`,emissiveIntensity:.5,flatShading:!1}),gold:new x({color:`#e0b04a`,metalness:.9,roughness:.22,emissive:`#6b4a10`,emissiveIntensity:.6,side:2}),bubble:gi(),geo:{a:fi(15,9,3,5),b:fi(24,16,8,4),c:fi(11,6,13,3),grove:pi(),sky:mi(),bell:hi(),bubbles:_i(e)}}),[e]);return(0,j.useEffect)(()=>()=>{Object.values(r.geo).forEach(e=>e.dispose()),[r.land,r.cloud,r.gold,r.bubble].forEach(e=>e.dispose())},[r]),Qr(t,[r.land,r.cloud,r.gold,r.bubble],2,.85,.8,(e,t)=>{n.current&&(n.current.rotation.z=Math.sin(t*.9)*.08)}),(0,M.jsxs)(`group`,{ref:t,children:[(0,M.jsx)(`mesh`,{geometry:r.geo.a,material:r.land,position:[-50,0,li-10]}),(0,M.jsx)(`mesh`,{geometry:r.geo.b,material:r.land,position:[-96,0,li-45]}),(0,M.jsx)(`mesh`,{geometry:r.geo.c,material:r.land,position:[48,0,li-25]}),(0,M.jsxs)(`group`,{position:[-38,0,li-105],children:[(0,M.jsx)(`mesh`,{geometry:r.geo.grove,material:r.land}),(0,M.jsx)(`mesh`,{geometry:r.geo.bubbles,material:r.bubble,frustumCulled:!1,renderOrder:3})]}),(0,M.jsxs)(`group`,{position:[-40,78,li-130],children:[(0,M.jsx)(`mesh`,{geometry:r.geo.sky,material:r.cloud}),(0,M.jsx)(`group`,{ref:n,position:[4,13.5,0],children:(0,M.jsx)(`mesh`,{geometry:r.geo.bell,material:r.gold,position:[0,-6.3,0]})})]})]})}var yi=`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
`,bi=`
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uFog;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform float uFlash;
uniform float uTime;
`,xi=`
vec3 skyGradient(vec3 d) {
  float h = d.y;
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uFog, smoothstep(0.03, -0.2, h));
  float sd = max(dot(d, uSunDir), 0.0);
  float up = smoothstep(-0.12, 0.05, uSunDir.y);
  col += uSunColor * uSunIntensity * up * (pow(sd, 14.0) * 0.38 + pow(sd, 4.0) * 0.07);
  return col;
}
`,Si=`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`,Q={x:72,z:-283,r:50,h:124},$={x:215,z:-340,length:300,height:210};function Ci(){let e=new Oe($.length,$.height,40,72,48,8),t=e.getAttribute(`position`);for(let e=0;e<t.count;e++){let n=t.getX(e),r=t.getY(e),i=t.getZ(e),a=.5-n/$.length,o=1-.62*Math.min(1,Math.max(0,(a-.55)/.45))**1.4,s=(ni(n*.05,r*.05,9.7,23)-.5)*26*(1-o),c=r+$.height/2;if(t.setY(e,c*o+s*(c/$.height)-$.height/2),i>0){let a=ni(r*.035,n*.03,3.1,11)-.5,o=Math.sin(r*.22+a*6)*1.6;t.setZ(e,i+a*30+o)}}return e.computeVertexNormals(),ii(e,{rock:`#8a2f22`,grass:`#9e3d2a`,tint:.45})}function wi(){let e=`#efe9dc`,t=[],n=new Oe(1,1,1),r=new E(1,1,1,10),i=new Re(1,12,8,0,Math.PI*2,0,Math.PI/2);for(let a=0;a<11;a++){let o=-4+a*14+a%2*3,s=7+a%3*4;t.push(Z(X(n,o,3+a%2*2,0,{s:[s,6+a%3*3,12]}),e)),a%2==0&&(t.push(Z(X(r,o+3,9,2,{s:[1.8,13,1.8]}),e)),t.push(Z(X(i,o+3,15.5,2,{s:2.4}),`#d9b25a`)))}return $r(t)}function Ti(){let e=[],t=[],n=[];for(let r=0;r<=70;r++){let i=r/70,a=i*(Q.h-12),o=Q.r*(1-a/Q.h)+4.5,s=1.85+i*.45,c=Math.cos(s)*o,l=Math.sin(s)*o,u=4.2*(1-i*.55),d=-Math.sin(s)*u,f=Math.cos(s)*u;if(e.push(c-d,a,l-f,c+d,a,l+f),t.push(0,i,1,i),r<70){let e=r*2;n.push(e,e+1,e+2,e+1,e+3,e+2)}}let r=new ye;return r.setAttribute(`position`,new C(e,3)),r.setAttribute(`uv`,new C(t,2)),r.setIndex(n),r}var Ei=()=>new S({uniforms:{uTime:Y.uTime,uVis:{value:0},uFogNear:Y.uFogNear,uFogFar:Y.uFogFar},transparent:!0,depthWrite:!1,side:2,blending:2,vertexShader:`
      varying vec2 vUv;
      varying float vDist;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      uniform float uTime;
      uniform float uVis;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying float vDist;
      ${yi}
      void main() {
        float flow = vUv.y * 22.0 - uTime * 3.2;
        float streak = vnoise(vec2(vUv.x * 7.0, flow)) * 0.7 + vnoise(vec2(vUv.x * 15.0, flow * 2.0)) * 0.3;
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        vec3 col = mix(vec3(0.08, 0.38, 0.55), vec3(0.85, 0.97, 1.0), smoothstep(0.35, 0.85, streak)) * 1.5;
        float fadeTop = smoothstep(1.0, 0.82, vUv.y);
        float fog = 1.0 - smoothstep(uFogNear, uFogFar * 1.15, vDist);
        gl_FragColor = vec4(col * edge * fadeTop * uVis * fog, 1.0);
      }`});function Di({sparkles:e}){let t=(0,j.useRef)(null),n=(0,j.useMemo)(()=>{let e=new x({vertexColors:!0,flatShading:!0,roughness:.95}),t=new x({vertexColors:!0,flatShading:!0,roughness:.9}),n=new x({vertexColors:!0,roughness:.6,emissive:`#3a2a18`,emissiveIntensity:.4}),r=Ei(),i=ii(ri(new Ce(Q.r,Q.h,56,26),11,.045,5),{rock:`#6d6258`,snow:`#f3f1ee`,snowLine:Q.h*.2,grass:`#58624a`,tint:.35});return{rock:e,stone:t,palaceMat:n,river:r,geo:{wall:Ci(),palace:wi(),mountain:i,river:Ti()}}},[]);return(0,j.useEffect)(()=>()=>{Object.values(n.geo).forEach(e=>e.dispose()),[n.rock,n.stone,n.palaceMat,n.river].forEach(e=>e.dispose())},[n]),Qr(t,[n.rock,n.stone,n.palaceMat,n.river],1,.8,.75),(0,M.jsxs)(`group`,{ref:t,children:[(0,M.jsx)(`mesh`,{geometry:n.geo.wall,material:n.rock,position:[$.x,$.height/2-20,$.z]}),(0,M.jsx)(`mesh`,{geometry:n.geo.palace,material:n.palaceMat,position:[$.x,$.height-20,$.z]}),(0,M.jsx)(`group`,{position:[Q.x,Q.h/2-12,Q.z],children:(0,M.jsx)(`mesh`,{geometry:n.geo.mountain,material:n.stone})}),(0,M.jsx)(`mesh`,{geometry:n.geo.river,material:n.river,position:[Q.x,-10,Q.z],renderOrder:2}),(0,M.jsx)(Le,{count:e,scale:[30,50,30],position:[Q.x-19,22,Q.z+35],size:5,speed:1.4,opacity:.6,color:`#e6f6ff`,noise:1.5})]})}var Oi=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},ki={length:7.2,width:2.35,height:1.5};function Ai(e,t){let n=Oi(0,.45,e),r=1-.16*Oi(.75,1,e),i=.32+.68*Math.max(0,t)**.55;return Math.max(.015,n*r)*i}function ji(e,t){let n=Math.abs(2*e-1);return(1-t)*.6*n**2.6+t*(.55*Math.max(0,1-2*e)**2+.42*Math.max(0,2*e-1)**2)}function Mi(e){let{length:t,width:n,height:r}=ki,i=new Oe(n,r,t,10,10,40),a=i.getAttribute(`position`),o=i.getAttribute(`normal`),s=[],c=new O(e.deck),l=new O(e.side),u=new O(e.stripe),d=new O(e.bottom),f=new O;for(let e=0;e<a.count;e++){let i=a.getX(e),p=a.getY(e),m=a.getZ(e),h=(m+t/2)/t,g=(p+r/2)/r;o.getY(e)>.9?f.copy(c):g<.3?f.copy(d):g>.78&&g<.9?f.copy(u):f.copy(l).multiplyScalar(.85+.3*(Math.round(g*9)%2*.5)),s.push(f.r,f.g,f.b),a.setXYZ(e,i/(n/2)*(n/2)*Ai(h,g),p+ji(h,g),m)}return i.setAttribute(`color`,new C(s,3)),i.computeVertexNormals(),i}function Ni(e){let{length:t,width:n,height:r}=ki,i=[];for(let a=0;a<=16;a++){let o=.04+a/16*.95,s=o*t-t/2;i.push(new T(n/2*e*Ai(o,1)*.97,r/2+ji(o,1)+.28,s))}return new Ne(i)}function Pi(e){return new Me(Ni(e),48,.05,5,!1)}function Fi(e,t,n){let r=new y(e,t,14,12),i=r.getAttribute(`position`);for(let r=0;r<i.count;r++){let a=i.getX(r)/e+.5,o=i.getY(r)/t+.5;i.setZ(r,-n*Math.sin(Math.PI*a)*(.55+.45*Math.sin(Math.PI*o)))}return r.computeVertexNormals(),r}function Ii(){let e=new ye;return e.setAttribute(`position`,new C([0,0,0,0,3.3,0,0,.1,-2.9],3)),e.setAttribute(`uv`,new C([1,0,1,1,0,0],2)),e.computeVertexNormals(),e}function Li(e){let t=e.size??512,n=document.createElement(`canvas`);n.width=n.height=t;let r=n.getContext(`2d`);if(r.fillStyle=e.cloth,r.fillRect(0,0,t,t),e.wear){for(let e=0;e<900;e++)r.fillStyle=`rgba(0,0,0,${Math.random()*.05})`,r.fillRect(Math.random()*t,Math.random()*t,2+Math.random()*30,1+Math.random()*3);let e=r.createRadialGradient(t/2,t/2,t*.2,t/2,t/2,t*.75);e.addColorStop(0,`rgba(0,0,0,0)`),e.addColorStop(1,`rgba(60,40,20,0.35)`),r.fillStyle=e,r.fillRect(0,0,t,t)}let i=t/512;r.save(),r.translate(t/2,t/2+14*i),r.fillStyle=e.ink;for(let e of[.72,-.72]){r.save(),r.rotate(e),r.beginPath(),r.roundRect(-165*i,-17*i,330*i,34*i,17*i),r.fill();for(let e of[-165,165])for(let t of[-20,20])r.beginPath(),r.arc(e*i,t*i,25*i,0,Math.PI*2),r.fill();r.restore()}r.beginPath(),r.ellipse(0,-48*i,104*i,96*i,0,0,Math.PI*2),r.fill(),r.beginPath(),r.roundRect(-58*i,20*i,116*i,62*i,16*i),r.fill(),r.globalCompositeOperation=`destination-out`,r.fillStyle=`#000`;for(let e of[-40,40])r.beginPath(),r.ellipse(e*i,-42*i,28*i,32*i,0,0,Math.PI*2),r.fill();r.beginPath(),r.moveTo(0,0),r.lineTo(-12*i,22*i),r.lineTo(12*i,22*i),r.closePath(),r.fill();for(let e of[-30,-10,10,30])r.fillRect((e-4)*i,48*i,8*i,30*i);r.restore(),r.globalCompositeOperation=`destination-over`,r.fillStyle=e.cloth,r.fillRect(0,0,t,t);let a=new xe(n);return a.colorSpace=pe,a.anisotropy=4,a}var Ri={hero:{deck:`#b98a57`,side:`#5a3a22`,stripe:`#c8963a`,bottom:`#4a1b15`,wood:`#6b4a2b`,cloth:`#f1e4c6`,ink:`#1b1510`,flag:`#111`,flagInk:`#f1e4c6`,lantern:`#ffb347`,gold:`#d4a94a`},dark:{deck:`#2a2420`,side:`#17151a`,stripe:`#7a1616`,bottom:`#0d0b0c`,wood:`#241c18`,cloth:`#1c1b1f`,ink:`#8e1b1b`,flag:`#0b0b0c`,flagInk:`#b3261e`,lantern:`#ff4a2a`,gold:`#6d5a3a`}};function zi(e,t,n){return e.onBeforeCompile=e=>{e.uniforms.uTime=Y.uTime;let r=n===`left`?`uv.x`:`sin(3.14159 * uv.x) * sin(3.14159 * uv.y)`;e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uTime;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
        float w = ${r};
        transformed.z += (sin(uTime * 3.4 + position.y * 2.1 + position.x * 1.3) * 0.6 + sin(uTime * 5.7 + position.x * 3.0) * 0.4) * ${t.toFixed(3)} * w;`)},e}function Bi(){let e=[],t=(t,n)=>e.push(...t,...n);for(let e of[-1,1])t([0,6.9,.3],[e*1.12,.95,1.1]),t([0,6.9,.3],[e*1.12,.95,-.4]),t([0,5.6,-2],[e*.95,.95,-1.4]),t([0,5.6,-2],[e*.8,.95,-2.6]);t([0,7.1,.3],[0,5.7,-2]),t([0,5.7,-2],[0,1.75,-5.55]),t([0,7.1,.3],[0,1.9,3.1]);let n=new ye;return n.setAttribute(`position`,new C(e,3)),n}var Vi=(0,j.forwardRef)(function({variant:e=`hero`,scale:t=1},n){let r=(0,j.useMemo)(()=>{let t=Ri[e],n=Mi(t),r=new x({vertexColors:!0,roughness:.82,metalness:.02}),i=new x({color:t.wood,roughness:.9}),a=new x({color:t.gold,metalness:.75,roughness:.35}),o=Li({cloth:t.cloth,ink:t.ink,wear:!0}),s=Li({cloth:t.flag,ink:t.flagInk,size:256}),c={color:`#ffffff`,roughness:1,side:2,emissive:e===`hero`?`#241c12`:`#120808`},l=zi(new x({...c,map:o}),.06,`frame`),u=zi(new x({...c,color:t.cloth}),.05,`frame`),d=zi(new x({map:s,side:2,roughness:1}),.16,`left`),f=new x({color:t.lantern,emissive:t.lantern,emissiveIntensity:5,toneMapped:!1}),p=new x({color:`#ffcf7a`,emissive:t.lantern,emissiveIntensity:2.4,toneMapped:!1}),m=new Ee({color:e===`hero`?`#2a1d12`:`#050505`,transparent:!0,opacity:.8});return{geo:{hull:n,railL:Pi(1),railR:Pi(-1),mainMast:new E(.1,.14,6.8,8),foreMast:new E(.09,.12,5.3,8),yard:new E(.055,.055,1,6),bowsprit:new E(.06,.1,2.6,6),mainSail:Fi(3.6,3.1,.55),topSail:Fi(2.9,1.6,.35),foreSail:Fi(3,2.5,.45),foreTop:Fi(2.3,1.3,.3),jib:Ii(),flag:new y(1.35,.85,12,6),cabin:new Oe(1.9,1,1.7),cabinRoof:new Oe(2.1,.12,1.9),windowPane:new Oe(.28,.24,.04),lantern:new Re(.12,12,8),nest:new E(.42,.34,.32,12,1,!0),figure:new Re(.26,16,12),halo:new ge(.34,.05,8,20),shrouds:Bi()},mat:{hullMat:r,wood:i,gold:a,mainSailMat:l,sailMat:u,flagMat:d,lantern:f,windowMat:p,rope:m},tex:[o,s]}},[e]);(0,j.useEffect)(()=>()=>{Object.values(r.geo).forEach(e=>e.dispose()),Object.values(r.mat).forEach(e=>e.dispose()),r.tex.forEach(e=>e.dispose())},[r]);let{geo:i,mat:a}=r,o=(e,t,n)=>(0,M.jsx)(`mesh`,{geometry:i.yard,material:a.wood,position:[0,e,t],rotation:[0,0,Math.PI/2],scale:[1,n,1]});return(0,M.jsxs)(`group`,{ref:n,scale:t,children:[(0,M.jsx)(`mesh`,{geometry:i.hull,material:a.hullMat}),(0,M.jsx)(`mesh`,{geometry:i.railL,material:a.wood}),(0,M.jsx)(`mesh`,{geometry:i.railR,material:a.wood}),(0,M.jsx)(`mesh`,{geometry:i.mainMast,material:a.wood,position:[0,4.05,.3]}),(0,M.jsx)(`mesh`,{geometry:i.foreMast,material:a.wood,position:[0,3.4,-2]}),(0,M.jsx)(`mesh`,{geometry:i.nest,material:a.wood,position:[0,5.95,.3]}),(0,M.jsx)(`mesh`,{geometry:i.bowsprit,material:a.wood,position:[0,1.35,-4.35],rotation:[-1.2,0,0]}),o(5.45,.3,3.9),o(2.35,.3,3.9),o(6.85,.3,3.1),o(4.55,-2,3.2),o(2.05,-2,3.2),(0,M.jsx)(`mesh`,{geometry:i.mainSail,material:a.mainSailMat,position:[0,3.9,.35]}),(0,M.jsx)(`mesh`,{geometry:i.topSail,material:a.sailMat,position:[0,6.1,.35]}),(0,M.jsx)(`mesh`,{geometry:i.foreSail,material:a.sailMat,position:[0,3.3,-1.95]}),(0,M.jsx)(`mesh`,{geometry:i.foreTop,material:a.sailMat,position:[0,5.2,-1.95]}),(0,M.jsx)(`mesh`,{geometry:i.jib,material:a.sailMat,position:[0,1.45,-2.25]}),(0,M.jsx)(`mesh`,{geometry:i.flag,material:a.flagMat,position:[0,7.45,.3-.7],rotation:[0,Math.PI/2,0]}),(0,M.jsx)(`mesh`,{geometry:i.cabin,material:a.hullMat,position:[0,1.42,2.35]}),(0,M.jsx)(`mesh`,{geometry:i.cabinRoof,material:a.wood,position:[0,1.97,2.35]}),[-.55,0,.55].map(e=>(0,M.jsx)(`mesh`,{geometry:i.windowPane,material:a.windowMat,position:[e,1.45,3.21]},e)),[-.82,.82].map(e=>(0,M.jsx)(`mesh`,{geometry:i.lantern,material:a.lantern,position:[e,2.25,3.15]},e)),(0,M.jsx)(`mesh`,{geometry:i.figure,material:a.gold,position:[0,1.22,-3.72]}),(0,M.jsx)(`mesh`,{geometry:i.halo,material:a.gold,position:[0,1.22,-3.72]}),(0,M.jsx)(`lineSegments`,{geometry:i.shrouds,material:a.rope})]})}),Hi=-495,Ui=[[44,Hi-60,.15],[68,Hi-95,-.1],[34,Hi-130,.25]];function Wi(){let e=(0,j.useRef)(null),t=(0,j.useRef)([]),r=(0,j.useMemo)(()=>({mat:new x({vertexColors:!0,flatShading:!0,roughness:.95}),stacks:[0,1,2,3].map(e=>ii(ri(new Ce(7+e*2,46+e*14,18,14),5,.08,40+e),{rock:`#2b3036`,grass:`#343a3a`,tint:.4}))}),[]);return(0,j.useEffect)(()=>()=>(r.stacks.forEach(e=>e.dispose()),r.mat.dispose()),[r]),D(r=>{let i=m(n.current,3,.75,.62),a=e.current;if(!a||(a.visible=i>.002,!a.visible))return;let o=r.clock.elapsedTime;Ui.forEach(([e,n,r],i)=>{let a=t.current[i];if(!a)return;let s=Ur(e,n,o,d.rough);a.position.set(e,Hr(e,n,o,d.rough)*1.1-.35,n),a.rotation.set(s[2]*.8,r,-s[0]*.8,`YXZ`)})}),(0,M.jsxs)(`group`,{ref:e,children:[Ui.map((e,n)=>(0,M.jsx)(Vi,{variant:`dark`,scale:1.8,ref:e=>void(t.current[n]=e)},n)),r.stacks.map((e,t)=>(0,M.jsx)(`mesh`,{geometry:e,material:r.mat,position:[-38-t*16,(46+t*14)/2-4,Hi-10-t*34]},t))]})}function Gi({settings:e}){return(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(Di,{sparkles:Math.round(e.sparkles*.5)}),(0,M.jsx)(vi,{bubbles:e.bubbles}),(0,M.jsx)(Wi,{}),(0,M.jsx)(ci,{sparkles:e.sparkles})]})}function Ki(){let e=[new T(0,150,0),new T((Math.random()-.5)*30,0,(Math.random()-.5)*12)],t=22;for(let n=0;n<6;n++){let n=[e[0]];for(let r=1;r<e.length;r++){let i=e[r-1].clone().add(e[r]).multiplyScalar(.5);i.x+=(Math.random()-.5)*t,i.z+=(Math.random()-.5)*t*.4,n.push(i,e[r])}e=n,t*=.55}return e}var qi=e=>e<.05?1:e<.1?.2:e<.17?.85:Math.max(0,.85-(e-.17)*2.2);function Ji(){let e=(0,j.useMemo)(()=>[Ki(),Ki(),Ki(),Ki()],[]),t=(0,j.useRef)([]),n=(0,j.useRef)({next:2.5,t:-1,which:0}),r=(0,j.useMemo)(()=>new T,[]);return D(({camera:i},o)=>{let s=n.current,c=Math.min(o,.05);if(d.lightning>.35&&(s.next-=c,s.next<=0&&s.t<0)){s.t=0,s.next=2.2+Math.random()*5.5,s.which=Math.floor(Math.random()*e.length);let n=t.current[s.which];if(n){i.getWorldDirection(r),r.y=0,r.normalize();let e=95+Math.random()*70,t=(Math.random()-.5)*140;n.position.set(i.position.x+r.x*e-r.z*t,0,i.position.z+r.z*e+r.x*t)}f.dispatchEvent(new CustomEvent(`strike`,{detail:{distance:95}}))}s.t>=0?(s.t+=c,a.value=qi(s.t)*d.lightning,s.t>.6&&(s.t=-1,a.value=0)):a.value=0,t.current.forEach((e,t)=>{e&&(e.visible=s.t>=0&&s.t<.24&&t===s.which)})}),(0,M.jsx)(M.Fragment,{children:e.map((e,n)=>(0,M.jsxs)(`group`,{ref:e=>void(t.current[n]=e),visible:!1,children:[(0,M.jsx)(xt,{points:e,color:`#e8f0ff`,lineWidth:2.2,toneMapped:!1,transparent:!0,opacity:.95}),(0,M.jsx)(xt,{points:e,color:`#8fb4ff`,lineWidth:7,toneMapped:!1,transparent:!0,opacity:.25})]},n))})}function Yi(e,t,n){let r=[0,0,0];for(let i=1;i<=t;i++){let a=n*(i/t)**2.1;for(let t=0;t<e;t++){let n=t/e*Math.PI*2;r.push(Math.cos(n)*a,0,Math.sin(n)*a)}}let i=[];for(let t=0;t<e;t++)i.push(0,1+(t+1)%e,1+t);for(let n=0;n<t-1;n++){let t=1+n*e,r=1+(n+1)*e;for(let n=0;n<e;n++){let a=(n+1)%e;i.push(t+n,t+a,r+n,t+a,r+a,r+n)}}let a=new ye;return a.setAttribute(`position`,new C(r,3)),a.setIndex(i),a}var Xi=`
uniform float uTime;
uniform float uRough;
varying vec3 vWorld;
varying vec2 vBase;
varying float vHeight;
${Gr}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec2 base = world.xz;
  float fade = 1.0 - smoothstep(90.0, 320.0, length(base - cameraPosition.xz));
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 disp = gerstner(base, uTime, uRough, tangent, binormal) * fade;
  world.xyz += disp;
  vWorld = world.xyz;
  vBase = base;
  vHeight = disp.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`,Zi=`
${bi}
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uRough;
uniform float uFoam;
uniform float uFogNear;
uniform float uFogFar;
uniform float uLight;
uniform vec3 uShip;
varying vec3 vWorld;
varying vec2 vBase;
varying float vHeight;
${yi}
${Gr}
${xi}

float wakeFoam(vec2 p, float t) {
  vec2 rel = p - uShip.xy;
  float cy = cos(uShip.z);
  float sy = sin(uShip.z);
  float along = dot(rel, vec2(sy, cy));
  float side = dot(rel, vec2(cy, -sy));
  float behind = along - 3.4;
  float width = 0.7 + max(behind, 0.0) * 0.12;
  float wobble = (vnoise(vec2(behind * 0.35 - t * 0.6, 3.0)) - 0.5) * 0.9;
  float trail = smoothstep(width, width * 0.2, abs(side + wobble)) * smoothstep(-0.5, 1.0, behind) * (1.0 - smoothstep(4.0, 34.0, behind));
  float churn = vnoise(vec2(side * 2.2, behind * 0.9 - t * 2.6)) * vnoise(vec2(side * 4.1 + 7.0, behind * 2.3 - t * 3.3));
  float e = length(vec2(side / 1.3, along / 3.8));
  float hull = smoothstep(1.3, 1.03, e) * smoothstep(0.9, 1.02, e);
  float lace = vnoise(vec2(side * 3.0, along * 2.2 - t * 1.8));
  return clamp(trail * smoothstep(0.12, 0.5, churn) * 1.6 + hull * smoothstep(0.35, 0.8, lace) * 0.9, 0.0, 1.0);
}

float rippleHeight(vec2 q, float t) {
  return vnoise(q + vec2(t * 0.16, t * 0.09)) + 0.55 * vnoise(q * 2.3 + vec2(-t * 0.12, t * 0.2)) + 0.3 * vnoise(q * 5.1 + vec2(t * 0.3, -t * 0.22));
}

vec2 ripple(vec2 p, float t) {
  vec2 q = p * 1.25;
  float e = 0.06;
  float h = rippleHeight(q, t);
  return vec2(h - rippleHeight(q + vec2(e, 0.0), t), h - rippleHeight(q + vec2(0.0, e), t)) / e;
}

void main() {
  float dist = length(vWorld - cameraPosition);
  float flat_ = smoothstep(90.0, 320.0, length(vBase - cameraPosition.xz));
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  gerstner(vBase, uTime, uRough * (1.0 - flat_), tangent, binormal);
  vec3 n = normalize(cross(binormal, tangent));
  vec2 r = ripple(vBase, uTime) * 0.045 * (1.0 - smoothstep(18.0, 150.0, dist)) * (0.6 + 0.4 * uRough);
  n = normalize(vec3(n.x + r.x, n.y, n.z + r.y));

  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, n);
  R.y = abs(R.y);
  vec3 refl = skyGradient(normalize(R));

  float crest = clamp(vHeight * 0.5 + 0.45, 0.0, 1.0);
  vec3 water = mix(uDeep, uShallow, crest * 0.85);
  float back = pow(max(dot(V, -uSunDir), 0.0), 4.0) * crest * uSunIntensity;
  water += uShallow * back * 0.4;
  water *= 0.55 + 0.45 * uLight;

  vec3 col = mix(water, refl * 0.9, clamp(fres, 0.0, 1.0) * 0.85);
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(n, H), 0.0);
  float up = smoothstep(-0.08, 0.04, uSunDir.y);
  col += uSunColor * uSunIntensity * up * (pow(nh, 520.0) * 12.0 + pow(nh, 70.0) * 0.3);

  float foamMask = smoothstep(0.45, 1.15, vHeight / max(0.25, uRough));
  float foamN = vnoise(vBase * 1.7 + uTime * 0.22) * vnoise(vBase * 4.6 - uTime * 0.18);
  float streaks = smoothstep(0.35, 0.75, vnoise(vec2(vBase.x * 0.35 + vBase.y * 0.9, vBase.y * 0.25 - uTime * 0.3)));
  float foam = clamp(foamMask * smoothstep(0.22, 0.5, foamN) * (0.4 + 0.6 * streaks) * 1.25 * uFoam, 0.0, 0.7) * (1.0 - flat_);
  foam = max(foam, wakeFoam(vBase, uTime) * 0.8);
  col = mix(col, vec3(0.9, 0.95, 1.0) * (0.25 + 0.75 * uLight), foam);

  col += uFlash * vec3(0.4, 0.5, 0.78) * (0.15 + fres);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  ${Si}
}
`,Qi=(e,t)=>Math.round(e/t)*t;function $i({radial:e,rings:t}){let n=(0,j.useRef)(null),r=(0,j.useMemo)(()=>Yi(e,t,760),[e,t]),i=(0,j.useMemo)(()=>new S({uniforms:{...Y},vertexShader:Xi,fragmentShader:Zi,fog:!1}),[]);return(0,j.useEffect)(()=>()=>r.dispose(),[r]),(0,j.useEffect)(()=>()=>i.dispose(),[i]),D(({camera:e})=>{n.current?.position.set(Qi(e.position.x,.25),0,Qi(e.position.z,.25))}),(0,M.jsx)(`mesh`,{ref:n,geometry:r,material:i,frustumCulled:!1,renderOrder:-1})}function ea({count:e}){let t=(0,j.useRef)(null),n=(0,j.useMemo)(()=>{let t=new y(.035,1.3),n=new ne;n.index=t.index,n.setAttribute(`position`,t.getAttribute(`position`)),n.setAttribute(`uv`,t.getAttribute(`uv`));let r=new Float32Array(e*3);for(let e=0;e<r.length;e++){let t=Math.sin((e+1)*91.345)*47453.5453;r[e]=t-Math.floor(t)}return n.setAttribute(`aSeed`,new le(r,3)),n.instanceCount=e,n},[e]),r=(0,j.useMemo)(()=>new S({transparent:!0,depthWrite:!1,uniforms:{uTime:Y.uTime,uRain:Y.uRain,uLight:Y.uLight,uFlash:Y.uFlash},vertexShader:`
          attribute vec3 aSeed;
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            float range = 46.0;
            vec3 cam = cameraPosition;
            vec3 p;
            p.x = cam.x + mod(aSeed.x * range - cam.x + range * 0.5, range) - range * 0.5;
            p.z = cam.z + mod(aSeed.z * range - cam.z + range * 0.5, range) - range * 0.5;
            p.y = cam.y + mod(aSeed.y * 34.0 - uTime * (24.0 + aSeed.x * 8.0), 34.0) - 17.0;
            vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
            vec3 world = p + right * position.x + vec3(position.y * 0.3, position.y, 0.0);
            gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
          }`,fragmentShader:`
          uniform float uRain;
          uniform float uLight;
          uniform float uFlash;
          varying vec2 vUv;
          void main() {
            float a = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y) * 0.32 * uRain;
            gl_FragColor = vec4(vec3(0.72, 0.8, 0.9) * (0.5 + uLight + uFlash * 2.0), a);
            #include <colorspace_fragment>
          }`}),[]);return(0,j.useEffect)(()=>()=>n.dispose(),[n]),(0,j.useEffect)(()=>()=>r.dispose(),[r]),D(()=>{t.current&&(t.current.visible=d.rain>.02)}),(0,M.jsx)(`mesh`,{ref:t,geometry:n,material:r,frustumCulled:!1,renderOrder:5})}var ta=[{v:0,cam:[-6,3.2,16],look:[-7.5,3.6,-16]},{v:.4,cam:[-11,4.8,11],look:[3,2.6,-9]},{v:1,cam:[-19,9.5,38],look:[4,25,-58]},{v:1.55,cam:[-9,12,16],look:[6,4,-30]},{v:2,cam:[14,8,20],look:[-1,12,-60]},{v:2.5,cam:[7,3.5,12],look:[-4,3.5,-14]},{v:3,cam:[-12,3.5,16],look:[4,5,-24]},{v:3.55,cam:[-5,5.5,14],look:[0,6,-40]},{v:4,cam:[-16,7,22],look:[4.4,21,-120]}],na=[{v:0,cam:[-3,5.8,25],look:[-1,9.6,-14]},{v:.4,cam:[-12,6.5,18],look:[1,5,-9]},{v:1,cam:[-18,12,44],look:[30,30,-70]},{v:1.55,cam:[-8,14,24],look:[4,7,-30]},{v:2,cam:[12,11,30],look:[-24,12,-60]},{v:2.5,cam:[7,5.5,19],look:[-2,6,-14]},{v:3,cam:[-8,4.5,20],look:[10,6.5,-24]},{v:3.55,cam:[-4,7,21],look:[0,8,-40]},{v:4,cam:[3,8.5,34],look:[-1,21,-90]}];function ra(e,t,n,i){let a=r(.95,.55,t);for(let[t,o]of[[ta,1-a],[na,a]]){if(o===0)continue;let a=0;for(;a<t.length-2&&e>t[a+1].v;)a++;let s=t[a],c=t[a+1],l=r(0,1,(e-s.v)/(c.v-s.v));for(let e=0;e<3;e++)n[e]+=(s.cam[e]+(c.cam[e]-s.cam[e])*l)*o,i[e]+=(s.look[e]+(c.look[e]-s.look[e])*l)*o}}var ia=`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}
`,aa=`
${bi}
uniform float uClouds;
uniform vec3 uCloudColor;
uniform float uStars;
uniform float uLight;
varying vec3 vDir;
${yi}
${xi}

void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyGradient(d);
  float sd = max(dot(d, uSunDir), 0.0);
  float up = smoothstep(-0.1, 0.02, uSunDir.y);
  col += uSunColor * uSunIntensity * up * (smoothstep(0.99955, 0.99975, sd) * 14.0 + pow(sd, 350.0) * 2.5);

  float cover = 0.0;
  if (d.y > -0.02) {
    vec2 uv = d.xz / (max(d.y, 0.0) + 0.16) * 1.35 + vec2(uTime * 0.01, uTime * 0.0035);
    float n = fbm(uv * 0.85);
    cover = smoothstep(0.66 - 0.34 * uClouds, 0.98 - 0.22 * uClouds, n) * smoothstep(-0.02, 0.2, d.y) * min(1.0, uClouds * 1.15);
    float rim = pow(sd, 5.0) * up;
    vec3 cloud = mix(uCloudColor * (0.55 + 0.25 * uLight), uCloudColor, smoothstep(0.4, 0.9, n)) + uSunColor * rim * 0.9 * uSunIntensity;
    col = mix(col, cloud, cover * 0.9);

    vec3 sp = d * 420.0;
    vec3 cell = floor(sp);
    float h = hash13(cell);
    float star = step(0.9955, h) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
    star *= 0.55 + 0.45 * sin(uTime * 1.7 + h * 60.0);
    col += vec3(0.95, 0.97, 1.0) * star * uStars * (1.0 - cover) * smoothstep(0.04, 0.3, d.y) * 1.6;
  }
  col += uFlash * vec3(0.55, 0.62, 0.88) * (0.2 + 0.8 * cover + 0.3 * smoothstep(-0.1, 0.5, d.y));
  gl_FragColor = vec4(col, 1.0);
  ${Si}
}
`;function oa(){let e=(0,j.useRef)(null),t=(0,j.useMemo)(()=>new Re(900,48,24),[]),n=(0,j.useMemo)(()=>new S({uniforms:{...Y},vertexShader:ia,fragmentShader:aa,side:1,depthWrite:!1,fog:!1}),[]);return(0,j.useEffect)(()=>()=>(t.dispose(),n.dispose()),[t,n]),D(({camera:t})=>e.current?.position.copy(t.position)),(0,M.jsx)(`mesh`,{ref:e,geometry:t,material:n,frustumCulled:!1,renderOrder:-2})}var sa=typeof window<`u`&&window.matchMedia(`(prefers-reduced-motion: reduce)`).matches?.3:1,ca=(e,t,n,r)=>e+(t-e)*(1-Math.exp(-n*r));function la({settings:e}){let{scene:r,camera:i,size:s}=he(),c=(0,j.useRef)(null),u=(0,j.useRef)(null),f=(0,j.useRef)(null),p=(0,j.useRef)(null),m=(0,j.useRef)({x:0,y:0}),h=(0,j.useMemo)(()=>({cam:[0,0,0],look:[0,0,0],target:new T,c:new O}),[]);return(0,j.useEffect)(()=>(r.fog=new ce(`#e9c29a`,45,230),()=>{r.fog=null}),[r]),D((e,g)=>{let ee=Math.min(g,.05),te=e.clock.elapsedTime*sa;n.current=ca(n.current,n.target,2.4,Math.min(g,.12));let ne=n.current;o(ne,d),Kr(d,te,a.value);let _=l(ne),v=Math.atan2(-_.dx,-_.dz),y=Hr(_.x,_.z,te,d.rough),re=Ur(_.x,_.z,te,d.rough);if(Y.uShip.value.set(_.x,_.z,v),c.current){c.current.position.set(_.x,y*.72-.2,_.z);let e=e=>Math.max(-.22,Math.min(.22,e*.65));c.current.rotation.set(e(re[2]),v,e(-re[0]),`YXZ`)}m.current.x=ca(m.current.x,t.x,3,ee),m.current.y=ca(m.current.y,t.y,3,ee),h.cam.fill(0),h.look.fill(0),ra(ne,s.width/Math.max(1,s.height),h.cam,h.look);let ie=Math.sin(te*.37)*.35;i.position.set(_.x+h.cam[0]+m.current.x*1.6+ie,Math.max(1.2,h.cam[1]+m.current.y*.9+Math.sin(te*.52)*.22+y*.25),_.z+h.cam[2]),h.target.set(_.x+h.look[0],h.look[1],_.z+h.look[2]),i.lookAt(h.target);let ae=r.fog;ae&&(ae.color.setRGB(d.fog[0],d.fog[1],d.fog[2]),ae.near=d.fogNear,ae.far=d.fogFar);let b=a.value;u.current&&(u.current.color.setRGB(d.skyTop[0]*.6+d.skyHorizon[0]*.4,d.skyTop[1]*.6+d.skyHorizon[1]*.4,d.skyTop[2]*.6+d.skyHorizon[2]*.4),u.current.groundColor.setRGB(d.deep[0],d.deep[1],d.deep[2]),u.current.intensity=.55+d.light*1.1+b*2.5),f.current&&(f.current.position.set(_.x+d.sunDir[0]*120,Math.max(8,d.sunDir[1]*120),_.z+d.sunDir[2]*120),f.current.target.position.set(_.x,0,_.z),f.current.target.updateMatrixWorld(),f.current.color.setRGB(d.sun[0],d.sun[1],d.sun[2]),f.current.intensity=d.sunIntensity*2.2*Math.max(.25,d.light)+b*3),p.current&&c.current&&(p.current.position.set(_.x,c.current.position.y+2.6,_.z+2.6),p.current.intensity=(1-d.light)*9)}),(0,M.jsxs)(M.Fragment,{children:[(0,M.jsx)(`hemisphereLight`,{ref:u,args:[`#9fb8d8`,`#0b2a44`,1]}),(0,M.jsx)(`directionalLight`,{ref:f,args:[`#ffd7a0`,2]}),(0,M.jsx)(`pointLight`,{ref:p,args:[`#ffb060`,0,14,1.6]}),(0,M.jsx)(oa,{}),(0,M.jsx)($i,{radial:e.oceanRadial,rings:e.oceanRings}),(0,M.jsx)(Vi,{ref:c}),(0,M.jsx)(Yr,{}),(0,M.jsx)(Gi,{settings:e}),(0,M.jsx)(ea,{count:e.rain}),(0,M.jsx)(Ji,{})]})}function ua({mode:e}){return(0,M.jsxs)(Mr,{multisampling:e===`full`?4:0,enableNormalPass:!1,children:[(0,M.jsx)(Pr,{mipmapBlur:!0,intensity:e===`full`?.85:.65,luminanceThreshold:1.05,luminanceSmoothing:.3,radius:.7}),(0,M.jsx)(Ir,{mode:W.ACES_FILMIC}),(0,M.jsx)(Lr,{offset:.3,darkness:.6})]})}function da({onReady:e}){let t=(0,j.useRef)(0);return D(()=>{t.current+=1,t.current===3&&e()}),null}function fa({initialTier:e,onReady:t}){let[n,r]=(0,j.useState)(e),a=p[n];return(0,M.jsxs)(Ae,{dpr:a.dpr,gl:{antialias:a.postprocessing===`off`,powerPreference:`high-performance`,alpha:!1,stencil:!1,toneMapping:4,preserveDrawingBuffer:i(`capture`)!==null},camera:{fov:50,near:.3,far:2400,position:[7.5,3,12.5]},"data-tier":n,children:[(0,M.jsx)(da,{onReady:t}),(0,M.jsx)(Ct,{flipflops:2,onDecline:()=>r(e=>c(e)),onFallback:()=>r(`low`)}),(0,M.jsx)(la,{settings:a}),a.postprocessing!==`off`&&(0,M.jsx)(ua,{mode:a.postprocessing})]})}export{fa as default};